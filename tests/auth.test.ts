import { beforeEach, expect, it, vi } from "vitest";

const { state, select } = vi.hoisted(() => ({ state: { config: null as unknown }, select: vi.fn() }));
vi.mock("next-auth", () => ({ default: (config: unknown) => { state.config = config; return {}; } }));
vi.mock("next-auth/providers/credentials", () => ({ default: (config: unknown) => config }));
vi.mock("@/db/client", () => ({ getDb: () => ({ select }), hasDatabaseUrl: () => true }));
import "@/auth";
import { resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimitForTests();
  select.mockClear();
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
});

it("rate limits credentials at provider boundary, including direct Auth.js requests", async () => {
  const config = state.config as { providers: { authorize: (credentials: unknown) => Promise<unknown> }[] };
  for (let i = 0; i < 9; i++) {
    expect(await config.providers[0].authorize({ email: "rate-limit@example.invalid", password: "invalid" })).toBeNull();
  }
  expect(select).toHaveBeenCalledTimes(8);
});

it("rejects renewal after password session version changes", async () => {
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ active: true, sessionVersion: 2 }] }) }) });
  const config = state.config as { callbacks: { jwt: (input: unknown) => Promise<unknown> } };
  expect(await config.callbacks.jwt({ token: { id: "user", sessionVersion: 1 } })).toBeNull();
});

it("keeps eight hour JWT lifetime without adding sliding polling", () => {
  expect((state.config as { session: unknown }).session).toMatchObject({ strategy: "jwt", maxAge: 28800 });
});

it("accepts current version and rejects pre-migration tokens or disabled users", async () => {
  const config = state.config as { callbacks: { jwt: (input: unknown) => Promise<unknown> } };
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ active: true, sessionVersion: 2 }] }) }) });
  await expect(config.callbacks.jwt({ token: { id: "user", sessionVersion: 2 } })).resolves.toMatchObject({ sessionVersion: 2 });
  await expect(config.callbacks.jwt({ token: { id: "user" } })).resolves.toBeNull();
  select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ active: false, sessionVersion: 2 }] }) }) });
  await expect(config.callbacks.jwt({ token: { id: "user", sessionVersion: 2 } })).resolves.toBeNull();
});
