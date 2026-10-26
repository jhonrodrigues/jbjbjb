import { beforeEach, expect, it, vi } from "vitest";

const { auth, lookup, redirect } = vi.hoisted(() => ({ auth: vi.fn(), lookup: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/db/client", () => ({
  hasDatabaseUrl: () => true,
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: lookup }) }) }) }),
}));
import { getSessionUser, requireAdmin } from "@/lib/auth-helpers";

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "synthetic-user", role: "admin", sessionVersion: 0 } });
});

it("rejects a disabled account even with an existing JWT", async () => {
  lookup.mockResolvedValue([{ id: "synthetic-user", role: "admin", active: false }]);
  expect(await getSessionUser()).toBeNull();
});

it("uses current database role, not stale JWT admin role", async () => {
  lookup.mockResolvedValue([{ id: "synthetic-user", role: "member", active: true, sessionVersion: 0 }]);
  await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
});

it("accepts active current administrator", async () => {
  lookup.mockResolvedValue([{ id: "synthetic-user", role: "admin", active: true, sessionVersion: 0 }]);
  await expect(requireAdmin()).resolves.toMatchObject({ id: "synthetic-user", role: "admin" });
});

it("rejects stale session version at protected resource boundary", async () => {
  lookup.mockResolvedValue([{ id: "synthetic-user", role: "admin", active: true, sessionVersion: 1 }]);
  expect(await getSessionUser()).toBeNull();
});
