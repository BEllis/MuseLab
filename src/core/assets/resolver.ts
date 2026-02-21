import type { Project, Asset } from "../model/types";

/**
 * Resolve an asset to a URL the renderer can use for <img> or <audio>.
 * - Web: uses asset.url (blob or data URL).
 * - Electron: uses asset.url if set, else asks main process for file URL (async).
 */
export async function getAssetUrlAsync(
  project: Project,
  assetId: string
): Promise<string> {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return "";

  if (asset.url) return asset.url;

  if (typeof window !== "undefined" && window.electronAPI?.resolveAssetUrl && asset.path) {
    return window.electronAPI.resolveAssetUrl(asset.path);
  }

  if (asset.path && (asset.path.startsWith("http") || asset.path.startsWith("/"))) {
    return asset.path;
  }

  return "";
}

/** Sync version for when url is already set (web or cached). Never returns raw filesystem paths (they break in img src). */
export function getAssetUrlSync(project: Project, assetId: string): string {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return "";
  if (asset.url) return asset.url;
  // Only use path when it's clearly a web URL; filesystem paths (e.g. /home/..., C:\...) must be resolved async (e.g. asset:// in Electron)
  if (asset.path && (asset.path.startsWith("http:") || asset.path.startsWith("https:")))
    return asset.path;
  return "";
}

export function getAssetById(project: Project, assetId: string): Asset | undefined {
  return project.assets.find((a) => a.id === assetId);
}
