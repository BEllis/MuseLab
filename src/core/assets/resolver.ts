import type { Project, Asset } from "../model/types";
import { actorImageDataUrl } from "./actorImageSerialization";
import { getWebAssetObjectUrl } from "./webAssetStorage";
import { isArchiveRelativePath } from "../project/assetArchivePaths";
import { getProjectArchiveBaseDir } from "../project/projectRuntimeContext";
import { isElectron } from "@/utils/isElectron";

function isAbsoluteFilesystemPath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}

function resolveFilesystemPath(asset: Asset): string | null {
  if (!asset.path) return null;
  if (asset.path.startsWith("http:") || asset.path.startsWith("https:")) {
    return asset.path;
  }
  if (isAbsoluteFilesystemPath(asset.path)) {
    return asset.path;
  }

  const baseDir = getProjectArchiveBaseDir();
  if (baseDir && isArchiveRelativePath(asset.path)) {
    const normalizedBase = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedRelative = asset.path.replace(/\\/g, "/").replace(/^\/+/, "");
    return `${normalizedBase}/${normalizedRelative}`;
  }

  return asset.path;
}

function isPersistableWebUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("http:") || url.startsWith("https:");
}

/**
 * Resolve an asset to a URL the renderer can use for <img> or <audio>.
 * - Web: uses asset.url (data URL) or IndexedDB blob storage.
 * - Electron: uses asset.url if set, else asks main process for file URL (async).
 */
export async function getAssetUrlAsync(
  project: Project,
  assetId: string
): Promise<string> {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return "";

  const embeddedActorUrl = actorImageDataUrl(asset);
  if (embeddedActorUrl) return embeddedActorUrl;

  if (asset.url && isPersistableWebUrl(asset.url)) return asset.url;

  if (!isElectron()) {
    const webUrl = await getWebAssetObjectUrl(assetId);
    if (webUrl) return webUrl;
  }

  const filesystemPath = resolveFilesystemPath(asset);
  if (typeof window !== "undefined" && window.electronAPI?.resolveAssetUrl && filesystemPath) {
    if (isAbsoluteFilesystemPath(filesystemPath) || filesystemPath.startsWith("/")) {
      return window.electronAPI.resolveAssetUrl(filesystemPath);
    }
  }

  if (filesystemPath && (filesystemPath.startsWith("http:") || filesystemPath.startsWith("https:"))) {
    return filesystemPath;
  }

  return "";
}

/** Sync version for when url is already set (web or cached). Never returns raw filesystem paths (they break in img src). */
export function getAssetUrlSync(project: Project, assetId: string): string {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return "";

  const embeddedActorUrl = actorImageDataUrl(asset);
  if (embeddedActorUrl) return embeddedActorUrl;

  if (asset.url && isPersistableWebUrl(asset.url)) return asset.url;
  // Only use path when it's clearly a web URL; filesystem paths (e.g. /home/..., C:\...) must be resolved async (e.g. asset:// in Electron)
  if (asset.path && (asset.path.startsWith("http:") || asset.path.startsWith("https:")))
    return asset.path;
  return "";
}

export function getAssetById(project: Project, assetId: string): Asset | undefined {
  return project.assets.find((a) => a.id === assetId);
}
