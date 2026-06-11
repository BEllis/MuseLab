import type { Project, Asset } from "../model/types";
import defaultFontDataUrl from "@/assets/default-font.woff2?inline";

/** Stable id for the built-in default font. */
export const DEFAULT_FONT_ID = "muselab-default-font";

export function createDefaultFontAsset(): Asset {
  return {
    id: DEFAULT_FONT_ID,
    type: "font",
    name: "default",
    url: defaultFontDataUrl,
  };
}

function defaultFontHasCustomMedia(asset: Asset): boolean {
  return Boolean(asset.path || asset.imageData || asset.blobStored);
}

/** Resolve a font asset id; missing or invalid selections fall back to the project default. */
export function resolveFontId(
  project: Project,
  fontId: string | null | undefined
): string {
  if (fontId) {
    const asset = project.assets.find((a) => a.id === fontId && a.type === "font");
    if (asset) return fontId;
  }
  return getDefaultFontId(project);
}

export function getDefaultFontId(project: Project): string {
  const candidate = project.defaultFontId;
  if (candidate) {
    const asset = project.assets.find((a) => a.id === candidate && a.type === "font");
    if (asset) return candidate;
  }
  return DEFAULT_FONT_ID;
}

/** Ensures every project has the default font asset and a valid defaultFontId. */
export function ensureDefaultFont(project: Project): void {
  const existing = project.assets.find((asset) => asset.id === DEFAULT_FONT_ID);
  if (!existing) {
    project.assets.push(createDefaultFontAsset());
  } else {
    existing.name = "default";
    existing.type = "font";
    if (
      !defaultFontHasCustomMedia(existing) &&
      (!existing.url || existing.url.startsWith("blob:"))
    ) {
      existing.url = defaultFontDataUrl;
    }
  }

  project.defaultFontId = getDefaultFontId(project);
}

export function isDefaultFont(assetId: string): boolean {
  return assetId === DEFAULT_FONT_ID;
}
