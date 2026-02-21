/**
 * Evaluate a single expression in a sandbox with only the provided context.
 * Used for template expressions and edge conditions.
 */
export type TemplateContext = {
  state: Record<string, unknown>;
  setState: (path: string, value: unknown) => void;
  emit: (eventName: string) => void;
  call: (name: string, ...args: unknown[]) => unknown;
  playSound: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
};

export function evaluateExpression(
  expr: string,
  context: TemplateContext
): unknown {
  if (!expr || !expr.trim()) return undefined;
  const keys = Object.keys(context) as (keyof TemplateContext)[];
  const values = keys.map((k) => context[k]);
  try {
    const fn = new Function(...keys, `"use strict"; return (${expr.trim()});`);
    return fn(...values);
  } catch {
    return undefined;
  }
}
