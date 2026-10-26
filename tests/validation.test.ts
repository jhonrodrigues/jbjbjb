import { describe, expect, it } from "vitest";
import {
  campaignInputSchema,
  jobClaimSchema,
  userUpdateSchema,
  userCreateSchema,
} from "@/lib/validation";

describe("validation schemas", () => {
  it("accepts campaign boolean values from checkboxes", () => {
    const parsed = campaignInputSchema.safeParse({
      name: "Barbearias",
      niche: "barbearia",
      autoAnalyze: true,
      autoLp: false,
      requireHuman: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.autoAnalyze).toBe(true);
      expect(parsed.data.autoLp).toBe(false);
      expect(parsed.data.maxLeads).toBe(100);
    }
  });

  it("rejects campaign without a niche", () => {
    expect(campaignInputSchema.safeParse({ name: "Teste", niche: "" }).success).toBe(false);
  });

  it("limits worker claim batches", () => {
    expect(jobClaimSchema.safeParse({ workerId: "n8n-1", limit: 21 }).success).toBe(false);
    expect(jobClaimSchema.safeParse({ workerId: "n8n-1", limit: 2 }).success).toBe(true);
  });

  it("requires strong passwords and normalizes e-mail", () => {
    const parsed = userCreateSchema.safeParse({
      name: "Admin",
      email: " ADMIN@Example.com ",
      password: "1234567890",
      role: "admin",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("admin@example.com");
    expect(userCreateSchema.safeParse({ name: "A", email: "x", password: "short" }).success).toBe(false);
  });

  it("allows an empty password on user update", () => {
    const parsed = userUpdateSchema.safeParse({
      userId: "00000000-0000-4000-8000-000000000000",
      name: "Membro",
      role: "member",
      password: "",
      active: true,
    });
    expect(parsed.success).toBe(true);
  });
});
