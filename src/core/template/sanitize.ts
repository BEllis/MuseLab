import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["b", "i", "p", "div", "br", "span"];
const ALLOWED_ATTR = ["class", "style"];

/**
 * Sanitize HTML to only allow basic styling tags: b, i, p, div, br, span.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
