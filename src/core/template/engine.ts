import { evaluateExpression, type TemplateContext } from "./sandbox";
import { isFormatTag, markupToHtml } from "./formatMarkup";
import { sanitizeHtml } from "./sanitize";

const EXPR_REGEX = /\{\{([^}]*)\}\}/g;
const IF_REGEX = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

/**
 * Process template string: {{#if}}, {{ expr }}, format calls ({{bold_start()}}), then HTML.
 */
export function runTemplate(
  template: string,
  context: TemplateContext
): string {
  const processed = processTemplateLogic(template, context);
  return sanitizeHtml(markupToHtml(processed));
}

/** Resolve conditionals and expressions; output is still markup, not HTML. */
function processTemplateLogic(template: string, context: TemplateContext): string {
  let out = processIfBlocks(template, context);
  out = processExpressions(out, context);
  return out;
}

function processIfBlocks(template: string, context: TemplateContext): string {
  return template.replace(IF_REGEX, (_, expr, body) => {
    const value = evaluateExpression(expr.trim(), context);
    if (value) {
      return processTemplateLogic(body, context);
    }
    return "";
  });
}

function processExpressions(str: string, context: TemplateContext): string {
  return str.replace(EXPR_REGEX, (full, expr) => {
    const trimmed = expr.trim();
    if (!trimmed || isFormatTag(trimmed)) return full;
    const value = evaluateExpression(trimmed, context);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

/**
 * Evaluate a condition expression (e.g. for edge visibility).
 * Returns true/false; swallows errors and returns false.
 */
export function evaluateCondition(
  condition: string | undefined,
  context: Pick<TemplateContext, "state">
): boolean {
  if (!condition || !condition.trim()) return true;
  try {
    const fn = new Function(
      "state",
      `"use strict"; return Boolean(${condition.trim()});`
    );
    return fn(context.state);
  } catch {
    return false;
  }
}
