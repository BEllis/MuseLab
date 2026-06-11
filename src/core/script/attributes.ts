import type { Attributes } from "../model/attributes";
import { normalizeAttributes, validateAttributes } from "../model/attributes";

export function exportAttributes(attrs: Attributes | undefined): Attributes | undefined {
  return normalizeAttributes(attrs);
}

export function importAttributes(value: unknown, path: string): Attributes | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return normalizeAttributes(validateAttributes(value, path));
}
