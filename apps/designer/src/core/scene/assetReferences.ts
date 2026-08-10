/**
 * Reference counter for rendering assets.
 *
 * Scene objects acquire a key when they start using an asset and release it when
 * they are removed. Only the last release unloads, so two props sharing one
 * asset never tear each other's texture down.
 */
export type AssetReferenceHooks = {
  onLoad?: (key: string) => void;
  onUnload?: (key: string) => void;
};

export function assetReferenceKey(assetId: string, variationId?: string): string {
  return variationId ? `${assetId}:${variationId}` : assetId;
}

export class AssetReferenceCounter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly hooks: AssetReferenceHooks = {}) {}

  acquire(key: string): void {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    if (next === 1) {
      this.hooks.onLoad?.(key);
    }
  }

  release(key: string): void {
    const current = this.counts.get(key);
    if (current === undefined) return;
    if (current <= 1) {
      this.counts.delete(key);
      this.hooks.onUnload?.(key);
      return;
    }
    this.counts.set(key, current - 1);
  }

  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  isLoaded(key: string): boolean {
    return this.counts.has(key);
  }

  loadedKeys(): string[] {
    return [...this.counts.keys()];
  }

  releaseAll(): void {
    for (const key of [...this.counts.keys()]) {
      this.counts.delete(key);
      this.hooks.onUnload?.(key);
    }
  }
}
