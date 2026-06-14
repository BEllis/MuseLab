/** Stable non-cryptographic hash for generated Cito class names (browser-safe). */
export function hashId(input: string, prefix: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const digest = (hash >>> 0).toString(16).padStart(8, "0");
  return `${prefix}_${digest}`;
}
