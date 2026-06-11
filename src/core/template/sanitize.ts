import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["b", "i", "br", "span"];
const ALLOWED_ATTR = ["class", "style", "data-muselab-font"];

/**
 * Sanitize rendered template HTML. Only tags emitted by Format.* helpers are allowed.
 * Author template text is escaped before render; this is a final safety pass.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
