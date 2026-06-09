import { DEFAULT_BACKDROP_ID } from "../assets/defaultBackdrop";

/** UUID v4 pattern (lowercase hex with hyphens). */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Returns true when `id` is a lowercase UUID v4 string. */
export function isUuid(id: string): boolean {
  return UUID_PATTERN.test(id);
}

/** Built-in module ids use the `builtin:` prefix and are not UUIDs. */
export function isBuiltinModuleId(id: string): boolean {
  return id.startsWith("builtin:");
}

/** Reserved ids that are not migrated to UUIDs. */
export function isReservedObjectId(id: string): boolean {
  return id === DEFAULT_BACKDROP_ID || isBuiltinModuleId(id);
}

/** True for UUID entity ids and reserved built-in ids. */
export function isObjectId(id: string): boolean {
  return isUuid(id) || isReservedObjectId(id);
}

/** Generate a new UUID v4 object id. */
export function generateId(): string {
  return crypto.randomUUID();
}
