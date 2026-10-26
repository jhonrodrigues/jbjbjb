import { hasDatabaseUrl } from "@/db/client";

export type PublicConfig = {
  appUrl: string;
  databaseConfigured: boolean;
  n8nConfigured: boolean;
  previewOrigin: string | null;
};

export function getAppUrl(): string {
  return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getPublicConfig(): PublicConfig {
  return {
    appUrl: getAppUrl(),
    databaseConfigured: hasDatabaseUrl(),
    n8nConfigured: Boolean(process.env.N8N_BASE_URL?.trim()),
    previewOrigin: process.env.LP_PREVIEW_ORIGIN?.trim() || null,
  };
}

export function getInternalApiSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) throw new Error("INTERNAL_API_SECRET_NOT_CONFIGURED");
  return secret;
}

export function getN8nWebhookSecret(): string | null {
  return process.env.N8N_WEBHOOK_SECRET?.trim() || null;
}

export function getN8nBaseUrl(): string | null {
  return process.env.N8N_BASE_URL?.trim().replace(/\/$/, "") || null;
}

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || "/app/uploads";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
