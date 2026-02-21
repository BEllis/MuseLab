import { evaluateExpression, type TemplateContext } from "./sandbox";
import { sanitizeHtml } from "./sanitize";

const EXPR_REGEX = /\{\{([^}]*)\}\}/g;
const IF_REGEX = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

/**
 * Process template string: replace {{ expr }} with evaluated result,
 * handle {{#if expr}}...{{/if}} blocks, then sanitize HTML.
 */
export function runTemplate(
  template: string,
  context: TemplateContext
): string {
  let out = template;

  // Handle {{#if expr}}...{{/if}} first (non-greedy match)
  out = out.replace(IF_REGEX, (_, expr, body) => {
    const value = evaluateExpression(expr.trim(), context);
    if (value) {
      return processExpressions(body, context);
    }
    return "";
  });

  // Replace {{ expr }} with evaluated value
  out = processExpressions(out, context);

  return sanitizeHtml(out);
}

function processExpressions(str: string, context: TemplateContext): string {
  return str.replace(EXPR_REGEX, (_, expr) => {
    const value = evaluateExpression(expr, context);
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
