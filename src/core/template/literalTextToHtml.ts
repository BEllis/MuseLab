export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render template literal text as HTML while keeping single spaces wrappable. */
export function literalTextToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length))
    .replace(/\n/g, "<br>");
}
