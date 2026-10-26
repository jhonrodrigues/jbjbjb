import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type RequestListener, type Server } from "node:http";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logInfo: vi.fn(), logWarn: vi.fn() }));
import { encryptWebhookSecret, decryptWebhookSecret, webhookSettingsSchema, sendWebhookWakeup } from "@/lib/n8n-webhook";

const secret = "synthetic-header-secret-123";
const context = { jobId: "job-1", campaignId: "campaign-1" };
let server: Server | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
  }
});
beforeEach(() => { vi.stubEnv("AUTH_SECRET", "synthetic-auth-secret-32-characters-only"); });

async function endpoint(handler: RequestListener) {
  server = createServer(handler);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS");
  return `http://127.0.0.1:${address.port}/webhook/jb-agent-executar`;
}

describe("webhook secret encryption", () => {
  it("roundtrips with randomized authenticated ciphertext, never plaintext", () => {
    const encrypted = encryptWebhookSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encryptWebhookSecret(secret)).not.toBe(encrypted);
    expect(decryptWebhookSecret(encrypted)).toBe(secret);
  });
  it("rejects tamper, wrong key and missing key", () => {
    const encrypted = encryptWebhookSecret(secret);
    const parts = encrypted.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptWebhookSecret(parts.join("."))).toThrow();
    vi.stubEnv("AUTH_SECRET", "different-synthetic-auth-key-32-characters");
    expect(() => decryptWebhookSecret(encrypted)).toThrow();
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => encryptWebhookSecret(secret)).toThrow();
  });
});

describe("configuration validation", () => {
  const valid = { url: "https://n8n.example.test/webhook/jb-agent-executar", headerName: "X-JB-Webhook-Secret", secret, clearSecret: false };
  it("accepts full URLs and blank password preservation", () => {
    expect(webhookSettingsSchema.safeParse(valid).success).toBe(true);
    expect(webhookSettingsSchema.safeParse({ ...valid, secret: "" }).success).toBe(true);
  });
  it.each([
    { url: "file:///etc/passwd" }, { url: "https://user:password@n8n.example.test/hook" },
    { url: "https://n8n.example.test/hook?secret=oops" }, { url: "https://n8n.example.test/hook#fragment" },
    { headerName: "Host" }, { headerName: "Content-Type" }, { headerName: "X-Test\r\nInjected" },
    { secret: "secret\r\nInjected: true" },
  ])("rejects unsafe URL/header input %j", (patch) => {
    expect(webhookSettingsSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("real HTTP wake-up", () => {
  it("POSTs context and header server-side and accepts 202 without reading response body", async () => {
    let received: unknown;
    let authentication: unknown;
    let method: unknown;
    const url = await endpoint((request, response) => {
      method = request.method;
      authentication = request.headers["x-jb-webhook-secret"];
      let body = "";
      request.on("data", chunk => { body += chunk; });
      request.on("end", () => { received = JSON.parse(body); response.writeHead(202); response.end("Workflow got started"); });
    });
    expect(await sendWebhookWakeup({ url, headerName: "X-JB-Webhook-Secret", secret }, context)).toMatchObject({ accepted: true, status: 202 });
    expect(received).toMatchObject(context);
    expect(authentication).toBe(secret);
    expect(method).toBe("POST");
  });
  it("does not follow redirects or treat non-2xx as acceptance", async () => {
    let requests = 0;
    const url = await endpoint((_request, response) => { requests++; response.writeHead(302, { Location: "/other" }); response.end(); });
    expect(await sendWebhookWakeup({ url, headerName: "X-Secret", secret }, context)).toMatchObject({ accepted: false, reason: "http_error", status: 302 });
    expect(requests).toBe(1);
  });
  it("times out a real server at five seconds", async () => {
    const url = await endpoint(() => { /* Deliberately do not answer. */ });
    const started = Date.now();
    expect(await sendWebhookWakeup({ url, headerName: "X-Secret", secret }, context)).toMatchObject({ accepted: false, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(7000);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4500);
  });
});
