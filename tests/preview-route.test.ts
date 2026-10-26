import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPreviewToken } from "@/lib/lp-preview";
vi.mock("@/lib/legacy", () => ({
  getLegacyLpById: async () => ({ html: "<h1>legacy</h1>" }),
  getLpVersionsForLp: async () => [
    { id: "new", htmlSnapshot: "<h1>new draft</h1>" },
    { id: "old", htmlSnapshot: "<h1>signed</h1>" },
  ],
}));
import { GET } from "@/app/api/lp-preview/[id]/route";
it("serves the signed version rather than the newest draft", async () => {
  const response = await GET(new NextRequest(`http://localhost/api/lp-preview/1?token=${createPreviewToken("1", "old")}`), { params: Promise.resolve({ id: "1" }) });
  expect(await response.text()).toBe("<h1>signed</h1>");
});
it("does not fall back to another version when signed HTML is missing", async () => {
  const response = await GET(new NextRequest(`http://localhost/api/lp-preview/1?token=${createPreviewToken("1", "missing")}`), { params: Promise.resolve({ id: "1" }) });
  expect(response.status).toBe(404);
});
