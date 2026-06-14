import type { Asset } from "../model/types";
import { normalizeExpressionName } from "../assets/actorExpressions";

export function resolveExpressionIdByName(actor: Asset, expressionName: string): string {
  const normalized = normalizeExpressionName(expressionName).toLowerCase();
  if (!normalized) {
    throw new Error(`Expression name must not be empty for actor "${actor.name}"`);
  }
  const expressions = actor.expressions ?? [];
  const matches = expressions.filter(
    (expr) => normalizeExpressionName(expr.name).toLowerCase() === normalized
  );
  if (matches.length === 0) {
    throw new Error(
      `Expression "${expressionName}" not found on actor "${actor.name}"`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous expression name "${expressionName}" on actor "${actor.name}"`
    );
  }
  return matches[0].id;
}
