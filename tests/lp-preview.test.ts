import { describe, expect, it, vi } from "vitest";
import {
  createPreviewToken,
  sanitizeLpHtml,
  verifyPreviewToken,
  readPreviewToken,
} from "@/lib/lp-preview";

describe("sanitizeLpHtml", () => {
  it("removes scripts, event handlers and javascript URLs", () => {
    const html = sanitizeLpHtml(`
      <html><body>
        <script>alert(1)</script>
        <a href="javascript:alert(1)" onclick="alert(2)">Clique</a>
        <img src="https://example.com/a.png" onerror="alert(3)" />
      </body></html>
    `);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("removes embedded frames and forms", () => {
    const html = sanitizeLpHtml('<iframe src="https://evil.test"></iframe><form><input type="password"></form>');
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="password"');
  });

  it("keeps safe markup and inline styles", () => {
    const html = sanitizeLpHtml('<section class="hero" style="color:#111"><h1>Olá</h1></section>');
    expect(html).toContain('<section class="hero" style="color:#111">');
    expect(html).toContain("<h1>Olá</h1>");
  });
});

describe("preview token", () => {
  it("validates a token only for the same LP", () => {
    const token = createPreviewToken("lp-1");
    expect(verifyPreviewToken(token, "lp-1")).toBe(true);
    expect(verifyPreviewToken(token, "lp-2")).toBe(false);
  });

  it("rejects tampered tokens", () => {
    const token = createPreviewToken("lp-1");
    expect(verifyPreviewToken(`${token}x`, "lp-1")).toBe(false);
    expect(verifyPreviewToken("invalid", "lp-1")).toBe(false);
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    const token = createPreviewToken("lp-1", undefined, 60);
    vi.setSystemTime(new Date("2026-10-26T12:02:00Z"));
    expect(verifyPreviewToken(token, "lp-1")).toBe(false);
    vi.useRealTimers();
  });

  it("returns only the signed version and rejects trailing token segments", () => {
    const token = createPreviewToken("lp-1", "version-a");
    expect(readPreviewToken(token, "lp-1")).toMatchObject({ version: "version-a" });
    expect(verifyPreviewToken(`${token}.extra`, "lp-1")).toBe(false);
  });
});
