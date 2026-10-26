import { createHmac, timingSafeEqual } from "node:crypto";
import sanitizeHtml from "sanitize-html";

const MAX_HTML_LENGTH = 2_000_000;

export function sanitizeLpHtml(input: string): string {
  const html = input.slice(0, MAX_HTML_LENGTH);
  return sanitizeHtml(html, {
    allowedTags: [
      "html", "head", "body", "title", "meta", "style",
      "header", "footer", "main", "section", "article", "aside", "nav",
      "div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "dl", "dt", "dd",
      "a", "strong", "b", "em", "i", "u", "small", "mark", "blockquote",
      "figure", "figcaption", "picture", "source",
      "img", "svg", "path", "g", "circle", "rect", "line", "polyline",
      "br", "hr", "table", "thead", "tbody", "tr", "th", "td",
      "button", "label", "input", "textarea", "select", "option",
    ],
    allowedAttributes: {
      "*": ["class", "id", "style", "data-*", "aria-*", "role", "title"],
      a: ["href", "target", "rel", "download"],
      img: ["src", "srcset", "alt", "width", "height", "loading"],
      source: ["src", "srcset", "type", "media"],
      meta: ["name", "content", "charset", "property"],
      input: ["type", "name", "value", "placeholder", "disabled", "checked"],
      textarea: ["name", "placeholder", "disabled"],
      select: ["name", "disabled"],
      option: ["value", "selected", "disabled"],
      svg: ["viewBox", "xmlns", "width", "height", "fill", "stroke"],
      path: ["d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"],
      circle: ["cx", "cy", "r", "fill", "stroke"],
      rect: ["x", "y", "width", "height", "rx", "fill", "stroke"],
      line: ["x1", "y1", "x2", "y2", "stroke"],
      polyline: ["points", "fill", "stroke"],
    },
    allowedSchemes: ["http", "https", "data", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        if (href.trim().toLowerCase().startsWith("javascript:")) {
          return { tagName, attribs: { ...attribs, href: "#", rel: "noopener noreferrer nofollow" } };
        }
        return { tagName, attribs: { ...attribs, rel: "noopener noreferrer nofollow" } };
      },
    },
    exclusiveFilter: (frame) =>
      ["script", "iframe", "object", "embed", "form"].includes(frame.tag) ||
      (frame.tag === "input" && ["password", "file"].includes(frame.attribs.type ?? "")),
  });
}

export type PreviewToken = {
  lpId: string;
  version?: string;
  exp: number;
};

function getPreviewSecret(): string {
  const secret = process.env.LP_PREVIEW_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("PREVIEW_SECRET_NOT_CONFIGURED");
  return secret;
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", getPreviewSecret()).update(value).digest("base64url");
}

export function createPreviewToken(lpId: string, version?: string, ttlSeconds = 300): string {
  const payload: PreviewToken = {
    lpId,
    version,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPreviewToken(token: string | null, lpId: string): boolean {
  return readPreviewToken(token, lpId) !== null;
}

export function readPreviewToken(token: string | null, lpId: string): PreviewToken | null {
  if (!token || token.length > 2048) return null;
  if (token.split(".").length !== 2) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PreviewToken;
    if (payload.lpId !== lpId || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.version !== undefined && typeof payload.version !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function previewResponseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; media-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts;",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store, max-age=0",
  };
}
