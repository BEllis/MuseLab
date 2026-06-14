import type { Project } from "../model/types";
import { getAssetUrlAsync } from "./resolver";

const loadedFontFamilies = new Set<string>();

export function fontFamilyForAsset(assetId: string): string {
  const sanitized = assetId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `MuselabFont-${sanitized}`;
}

export function parseFontIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  const pattern = /data-muselab-font="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return [...ids];
}

export async function loadFontFace(project: Project, assetId: string): Promise<void> {
  const family = fontFamilyForAsset(assetId);
  if (loadedFontFamilies.has(family)) return;

  const url = await getAssetUrlAsync(project, assetId);
  if (!url) return;

  const font = new FontFace(family, `url("${url}")`);
  await font.load();
  document.fonts.add(font);
  loadedFontFamilies.add(family);
}

export async function loadFontsForProject(project: Project, assetIds: string[]): Promise<void> {
  const unique = [...new Set(assetIds.filter(Boolean))];
  await Promise.all(unique.map((assetId) => loadFontFace(project, assetId)));
}

/** Test helper: reset in-memory font load cache. */
export function resetLoadedFontsForTests(): void {
  loadedFontFamilies.clear();
}
