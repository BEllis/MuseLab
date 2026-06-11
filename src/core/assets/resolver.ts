import type { Project, Asset } from "../model/types";
import { expressionImageDataUrl } from "./actorImageSerialization";
import { expressionBlobKey, findExpression, PLACEHOLDER_EXPRESSION_URL } from "./actorExpressions";
import { getElectronAssetBlobUrl } from "./electronAssetBlob";
import { getWebAssetObjectUrl } from "./webAssetStorage";
import { isArchiveRelativePath } from "../project/assetArchivePaths";
import { getProjectArchiveBaseDir } from "../project/projectRuntimeContext";
import { isElectron } from "@/utils/isElectron";
import { actorImageDataUrl } from "./actorImageSerialization";

function isAbsoluteFilesystemPath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}

function resolveFilesystemPathFromRelativePath(relativeOrAbsolutePath: string): string | null {
  if (relativeOrAbsolutePath.startsWith("http:") || relativeOrAbsolutePath.startsWith("https:")) {
    return relativeOrAbsolutePath;
  }
  if (isAbsoluteFilesystemPath(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }

  const baseDir = getProjectArchiveBaseDir();
  if (baseDir && isArchiveRelativePath(relativeOrAbsolutePath)) {
    const normalizedBase = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedRelative = relativeOrAbsolutePath.replace(/\\/g, "/").replace(/^\/+/, "");
    return `${normalizedBase}/${normalizedRelative}`;
  }

  return relativeOrAbsolutePath;
}

function resolveFilesystemPath(asset: Asset): string | null {
  if (!asset.path) return null;
  return resolveFilesystemPathFromRelativePath(asset.path);
}

function isPersistableWebUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("http:") || url.startsWith("https:");
}

function isBuiltInPlaceholderUrl(url: string | undefined): boolean {
  return url === PLACEHOLDER_EXPRESSION_URL;
}

async function resolveMediaUrl(options: {
  embeddedDataUrl: string | null;
  url?: string;
  blobStorageKey: string;
  filesystemPath?: string | null;
  isSound?: boolean;
}): Promise<string> {
  if (options.embeddedDataUrl) return options.embeddedDataUrl;

  if (options.url && isPersistableWebUrl(options.url)) return options.url;

  if (!isElectron()) {
    const webUrl = await getWebAssetObjectUrl(options.blobStorageKey);
    if (webUrl) return webUrl;
  }

  const filesystemPath = options.filesystemPath ?? null;
  if (
    filesystemPath &&
    (isAbsoluteFilesystemPath(filesystemPath) || filesystemPath.startsWith("/"))
  ) {
    if (isElectron() && options.isSound) {
      return getElectronAssetBlobUrl(filesystemPath);
    }
    if (typeof window !== "undefined" && window.electronAPI?.resolveAssetUrl) {
      return window.electronAPI.resolveAssetUrl(filesystemPath);
    }
  }

  if (filesystemPath && (filesystemPath.startsWith("http:") || filesystemPath.startsWith("https:"))) {
    return filesystemPath;
  }

  if (isElectron() && options.isSound) {
    const webUrl = await getWebAssetObjectUrl(options.blobStorageKey);
    if (webUrl) return webUrl;
  }

  return "";
}

function resolveMediaUrlSync(options: {
  embeddedDataUrl: string | null;
  url?: string;
  filesystemPath?: string | null;
}): string {
  if (options.embeddedDataUrl) return options.embeddedDataUrl;
  if (options.url && isPersistableWebUrl(options.url)) return options.url;
  const filesystemPath = options.filesystemPath ?? null;
  if (filesystemPath && (filesystemPath.startsWith("http:") || filesystemPath.startsWith("https:"))) {
    return filesystemPath;
  }
  return "";
}

export async function getActorExpressionUrlAsync(
  project: Project,
  actorId: string,
  expressionId: string
): Promise<string> {
  const actor = project.assets.find((a) => a.id === actorId && a.type === "actor");
  if (!actor) return "";
  const expression = findExpression(actor, expressionId);
  if (!expression) return "";

  return resolveMediaUrl({
    embeddedDataUrl: expressionImageDataUrl(expression),
    url: expression.url,
    blobStorageKey: expressionBlobKey(actorId, expressionId),
    filesystemPath: expression.path
      ? resolveFilesystemPathFromRelativePath(expression.path)
      : null,
  });
}

export function getActorExpressionUrlSync(
  project: Project,
  actorId: string,
  expressionId: string
): string {
  const actor = project.assets.find((a) => a.id === actorId && a.type === "actor");
  if (!actor) return "";
  const expression = findExpression(actor, expressionId);
  if (!expression) return "";

  return resolveMediaUrlSync({
    embeddedDataUrl: expressionImageDataUrl(expression),
    url: expression.url,
    filesystemPath: expression.path
      ? resolveFilesystemPathFromRelativePath(expression.path)
      : null,
  });
}

/**
 * Resolve an asset to a URL the renderer can use for <img> or <audio>.
 * - Web: uses asset.url (data URL) or IndexedDB blob storage.
 * - Electron images: asset:// file protocol URL.
 * - Electron sounds: blob URL (Chromium cannot reliably decode audio from custom protocols).
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
  if (
    filesystemPath &&
    (isAbsoluteFilesystemPath(filesystemPath) || filesystemPath.startsWith("/"))
  ) {
    if (isElectron() && (asset.type === "sound" || asset.type === "font")) {
      return getElectronAssetBlobUrl(filesystemPath);
    }
    if (typeof window !== "undefined" && window.electronAPI?.resolveAssetUrl) {
      return window.electronAPI.resolveAssetUrl(filesystemPath);
    }
  }

  if (filesystemPath && (filesystemPath.startsWith("http:") || filesystemPath.startsWith("https:"))) {
    return filesystemPath;
  }

  if (isElectron() && (asset.type === "sound" || asset.type === "font")) {
    const webUrl = await getWebAssetObjectUrl(assetId);
    if (webUrl) return webUrl;
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
  if (asset.path && (asset.path.startsWith("http:") || asset.path.startsWith("https:")))
    return asset.path;
  return "";
}

export function getAssetById(project: Project, assetId: string): Asset | undefined {
  return project.assets.find((a) => a.id === assetId);
}

export { isBuiltInPlaceholderUrl };
