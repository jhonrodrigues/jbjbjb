import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { logInfo, logWarn } from "./logger";

const SETTINGS_KEY = "n8n_webhook";
const DEFAULT_HEADER = "X-JB-Webhook-Secret";
const AAD = Buffer.from("jb-agent-autopilot:n8n-webhook:v1");
const RESERVED_HEADERS = new Set([
  "host", "content-type", "content-length", "connection", "transfer-encoding", "upgrade",
  "cookie", "set-cookie", "te", "trailer", "keep-alive", "proxy-authorization", "proxy-authenticate",
]);

export const webhookSettingsSchema = z.object({
  url: z.string().trim().max(2048).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) &&
        !url.username && !url.password && !url.search && !url.hash;
    } catch { return false; }
  }, "Informe URL HTTP(S) completa, sem credenciais, parâmetros ou fragmento."),
  headerName: z.string().trim().min(1).max(128)
    .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, "Nome de cabeçalho inválido.")
    .refine(value => !RESERVED_HEADERS.has(value.toLowerCase()) && !/^(sec-|proxy-)/i.test(value), "Cabeçalho reservado."),
  secret: z.string().max(4096).refine(value => value === "" || (value.length >= 16 && /^[\x20-\x7e]+$/.test(value)), "Use segredo de pelo menos 16 caracteres ASCII, sem quebras de linha."),
  clearSecret: z.boolean().default(false),
});

export type WebhookSettingsSummary = { url: string; headerName: string; secretConfigured: boolean };
type StoredWebhookSettings = { url: string; headerName: string; encryptedSecret: string | null };
type WakeupContext = { jobId: string; campaignId: string };
type WebhookCredentials = { url: string; headerName: string; secret: string };
export type WakeupResult = { accepted: boolean; reason: "accepted" | "not_configured" | "http_error" | "timeout" | "network_error" | "configuration_error"; status?: number };

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("WEBHOOK_ENCRYPTION_KEY_NOT_CONFIGURED");
  return Buffer.from(hkdfSync("sha256", secret, "jb-agent-autopilot", "n8n-webhook:v1", 32));
}

export function encryptWebhookSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptWebhookSecret(value: string): string {
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra !== undefined) throw new Error("WEBHOOK_CIPHERTEXT_INVALID");
  const ivBytes = Buffer.from(iv, "base64url");
  const tagBytes = Buffer.from(tag, "base64url");
  if (ivBytes.length !== 12 || tagBytes.length !== 16) throw new Error("WEBHOOK_CIPHERTEXT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), ivBytes);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function parseStored(value: unknown): StoredWebhookSettings {
  if (!value) return { url: "", headerName: DEFAULT_HEADER, encryptedSecret: null };
  const stored = z.object({ url: z.string(), headerName: z.string(), encryptedSecret: z.string().nullable() }).parse(value);
  webhookSettingsSchema.parse({ ...stored, secret: "" });
  return stored;
}

async function readStoredSettings(): Promise<StoredWebhookSettings> {
  const [row] = await getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
  return parseStored(row?.value);
}

// Whitelist projection only. Neither ciphertext nor decrypted secret belongs in page props.
export async function getWebhookSettingsSummary(): Promise<WebhookSettingsSummary> {
  const stored = await readStoredSettings();
  return { url: stored.url, headerName: stored.headerName, secretConfigured: Boolean(stored.encryptedSecret) };
}

export async function isWebhookConfigured(): Promise<boolean> {
  const stored = await readStoredSettings();
  return Boolean(stored.url && stored.encryptedSecret);
}

export async function saveWebhookSettings(input: unknown, userId: string): Promise<void> {
  const parsed = webhookSettingsSchema.parse(input);
  if (parsed.clearSecret && parsed.secret) throw new Error("WEBHOOK_CLEAR_AND_REPLACE_CONFLICT");
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('jb_agent_n8n_webhook_settings'))`);
    const [row] = await tx.select({ value: settings.value }).from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
    const previous = parseStored(row?.value);
    const encryptedSecret = parsed.clearSecret ? null : parsed.secret ? encryptWebhookSecret(parsed.secret) : previous.encryptedSecret;
    if (parsed.url && !encryptedSecret && !parsed.clearSecret) throw new Error("WEBHOOK_SECRET_REQUIRED");
    const value = { url: parsed.url, headerName: parsed.headerName, encryptedSecret };
    await tx.insert(settings).values({ key: SETTINGS_KEY, value, updatedBy: userId }).onConflictDoUpdate({
      target: settings.key, set: { value, updatedBy: userId, updatedAt: new Date() },
    });
  });
}

export async function sendWebhookWakeup(credentials: WebhookCredentials, context: WakeupContext): Promise<WakeupResult> {
  if (!webhookSettingsSchema.safeParse({ ...credentials, clearSecret: false }).success || !credentials.url) {
    return { accepted: false, reason: "configuration_error" };
  }
  const signal = AbortSignal.timeout(5000);
  try {
    const response = await fetch(credentials.url, {
      method: "POST", redirect: "manual", cache: "no-store", signal,
      headers: { "Content-Type": "application/json", [credentials.headerName]: credentials.secret },
      body: JSON.stringify({ event: "campaign.execute", ...context }),
    });
    // Immediate acknowledgement only; never consume/log an untrusted response body.
    void response.body?.cancel().catch(() => {});
    return { accepted: response.ok, reason: response.ok ? "accepted" : "http_error", status: response.status };
  } catch {
    return { accepted: false, reason: signal.aborted ? "timeout" : "network_error" };
  }
}

export async function dispatchCampaignWakeup(context: WakeupContext): Promise<WakeupResult> {
  let result: WakeupResult;
  try {
    const config = await readStoredSettings();
    result = config.url && config.encryptedSecret
      ? await sendWebhookWakeup({ url: config.url, headerName: config.headerName, secret: decryptWebhookSecret(config.encryptedSecret) }, context)
      : { accepted: false, reason: "not_configured" };
  } catch {
    result = { accepted: false, reason: "configuration_error" };
  }
  // Do not log URL, header, secret, ciphertext, response body or exception details.
  const data = { ...context, reason: result.reason, status: result.status };
  if (result.accepted) logInfo("Sinal de execução aceito pelo n8n", data);
  else logWarn("Sinal n8n não confirmado; fila preservada para o Schedule", data);
  return result;
}
