import { beforeEach, expect, it, vi } from "vitest";

const { state, transaction, update, db } = vi.hoisted(() => {
  const state = { insideTransaction: false, updatedInsideTransaction: false, adminCount: 2, lastUpdate: undefined as Record<string, unknown> | undefined };
  const update = vi.fn(() => ({ set: (values: Record<string, unknown>) => ({ where: async () => { state.updatedInsideTransaction = state.insideTransaction; state.lastUpdate = values; } }) }));
  const db = {
    select: (fields?: unknown) => ({ from: () => ({ where: () => {
      const rows = fields ? [{ value: state.adminCount }] : [{ role: "admin", active: true }];
      return Object.assign(Promise.resolve(rows), { limit: async () => rows });
    } }) }),
    update,
    execute: vi.fn(),
  };
  const transaction = vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => {
    state.insideTransaction = true;
    try { return await callback(db); } finally { state.insideTransaction = false; }
  });
  return { state, transaction, update, db };
});
vi.mock("@/db/client", () => ({ getDb: () => ({ ...db, transaction }) }));
vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: async () => ({ id: "other-admin", role: "admin" }) }));
vi.mock("@/lib/audit", () => ({ recordActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { toggleUserActiveAction, updateUserAction } from "@/actions/users";

beforeEach(() => {
  vi.clearAllMocks();
  state.adminCount = 2;
  state.updatedInsideTransaction = false;
  state.lastUpdate = undefined;
});

function form(options: { active?: boolean; password?: string } = {}) {
  const data = new FormData();
  data.set("name", "Synthetic User");
  data.set("role", "member");
  if (options.active !== false) data.set("active", "on");
  if (options.password) data.set("password", options.password);
  return data;
}
const id = "00000000-0000-4000-8000-000000000001";

it("updates role inside the same transaction as administrator invariant validation", async () => {
  await expect(updateUserAction(id, form())).rejects.toThrow("REDIRECT:/configuracoes?tab=admin&ok=1");
  expect(state.updatedInsideTransaction).toBe(true);
  expect(db.execute).toHaveBeenCalledOnce();
});

it("keeps the last active administrator and preserves its specific redirect", async () => {
  state.adminCount = 1;
  await expect(updateUserAction(id, form())).rejects.toThrow(encodeURIComponent("É necessário manter ao menos um administrador ativo."));
  expect(update).not.toHaveBeenCalled();
});

it("revokes existing sessions when user is deactivated in the edit form", async () => {
  await expect(updateUserAction(id, form({ active: false }))).rejects.toThrow("REDIRECT:/configuracoes?tab=admin&ok=1");
  expect(state.lastUpdate?.active).toBe(false);
  expect(state.lastUpdate?.sessionVersion).toBeDefined();
});

it("revokes existing sessions when user is deactivated through the toggle action", async () => {
  await expect(toggleUserActiveAction(id, false)).rejects.toThrow("REDIRECT:/configuracoes?tab=admin&ok=1");
  expect(state.lastUpdate?.active).toBe(false);
  expect(state.lastUpdate?.sessionVersion).toBeDefined();
});

it("also prevents disabling the last admin through the toggle action", async () => {
  state.adminCount = 1;
  await expect(toggleUserActiveAction(id, false)).rejects.toThrow(encodeURIComponent("É necessário manter ao menos um administrador ativo."));
  expect(update).not.toHaveBeenCalled();
});
