import type { TemplateFoldRange } from "@/core/cito/parseTemplateSurface";

function truncate(text: string, max = 28): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function expressionFoldLabel(range: TemplateFoldRange): string {
  if (range.kind === "if") {
    return `▶ if ${truncate(range.condition ?? "")}`;
  }
  const expr = range.expr?.trim() ?? "";
  if (!expr) return "▶ @";
  const head = expr.split("(")[0]?.trim() ?? expr;
  return `▶ ${truncate(head)}`;
}

export function shouldDefaultCollapseFold(range: TemplateFoldRange): boolean {
  if (range.kind === "if") return true;
  return range.isStatement;
}
