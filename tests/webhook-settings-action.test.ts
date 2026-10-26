import { beforeEach, expect, it, vi } from "vitest";
const { requireAdmin, saveWebhookSettings } = vi.hoisted(() => ({ requireAdmin: vi.fn(), saveWebhookSettings: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ requireAdmin }));
vi.mock("@/lib/n8n-webhook", () => ({ saveWebhookSettings }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordActivity: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logWarn: vi.fn(), logError: vi.fn() }));
import { saveWebhookSettingsAction } from "@/actions/settings";

beforeEach(() => { vi.clearAllMocks(); requireAdmin.mockResolvedValue({ id: "admin" }); });
const initial = { error: null, success: null };
it("rejects non-admin before touching configuration", async () => {
  requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(saveWebhookSettingsAction(initial, new FormData())).rejects.toThrow("FORBIDDEN");
  expect(saveWebhookSettings).not.toHaveBeenCalled();
});
it("never returns submitted secret or exception details in action state", async () => {
  const form = new FormData();
  form.set("secret", "synthetic-private-secret");
  saveWebhookSettings.mockRejectedValue(new Error("synthetic-private-secret"));
  const result = await saveWebhookSettingsAction(initial, form);
  expect(result.error).toBeTruthy();
  expect(JSON.stringify(result)).not.toContain("synthetic-private-secret");
});
