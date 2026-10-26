import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { service: "jb-agent-autopilot" },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "secret",
      "authorization",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
});

export function logInfo(message: string, data: Record<string, unknown> = {}): void {
  logger.info(data, message);
}

export function logWarn(message: string, data: Record<string, unknown> = {}): void {
  logger.warn(data, message);
}

export function logError(message: string, error: unknown, data: Record<string, unknown> = {}): void {
  logger.error(
    {
      ...data,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    },
    message,
  );
}

export { logger };
