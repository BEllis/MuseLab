import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Asset, AssetType, Project } from "../model/types";
import {
  PROJECT_MANIFEST,
  assetArchivePath,
  extensionForMime,
  isArchiveRelativePath,
} from "./assetArchivePaths";
import { serializeProject } from "../model/project";
import { base64ToBlob } from "../assets/actorImageSerialization";
import { isDefaultBackdrop } from "../assets/defaultBackdrop";
import { getAssetUrlAsync } from "../assets/resolver";
import { getAssetBlob } from "../assets/webAssetStorage";

const DEFAULT_IMAGE_MIME = "image/png";

function parseDataUrl(url: string): { mimeType: string; imageData: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageData: match[2] };
}

function defaultFallbackExtension(type: AssetType): string {
  return type === "sound" ? ".mp3" : ".png";
}

function assetHasPackableMedia(asset: Asset): boolean {
  if (isDefaultBackdrop(asset.id)) {
    return Boolean(asset.path || asset.imageData || asset.blobStored);
  }
  return Boolean(
    asset.path ||
      asset.imageData ||
      asset.blobStored ||
      (asset.url && !asset.url.startsWith("blob:"))
  );
}

async function resolveAssetBytes(
  project: Project,
  asset: Asset
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (asset.imageData) {
    const mime = asset.imageMimeType || DEFAULT_IMAGE_MIME;
    const blob = base64ToBlob(asset.imageData, mime);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime };
  }

  if (asset.url?.startsWith("data:")) {
    const parsed = parseDataUrl(asset.url);
    if (parsed) {
      const blob = base64ToBlob(parsed.imageData, parsed.mimeType);
      return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: parsed.mimeType };
    }
  }

  const stored = await getAssetBlob(asset.id);
  if (stored) {
    return {
      bytes: new Uint8Array(await stored.arrayBuffer()),
      mime: stored.type || (asset.type === "sound" ? "audio/mpeg" : "image/png"),
    };
  }

  if (asset.path && isArchiveRelativePath(asset.path)) {
    return null;
  }

  const url = await getAssetUrlAsync(project, asset.id);
  if (!url) return null;

  const response = await fetch(url);
  if (!response.ok) return null;

  const blob = await response.blob();
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime: blob.type || (asset.type === "sound" ? "audio/mpeg" : "image/png"),
  };
}

function stripAssetForManifest(asset: Asset): void {
  delete asset.url;
  delete asset.imageData;
  delete asset.imageMimeType;
  delete asset.blobStored;
}

export function looksLikeZip(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b;
}

export function isLegacyJsonProject(data: Uint8Array | string): boolean {
  const text = typeof data === "string" ? data.trim() : strFromU8(data).trim();
  return text.startsWith("{");
}

export async function packProjectArchive(project: Project): Promise<Uint8Array> {
  const cloned = JSON.parse(JSON.stringify(project)) as Project;
  const zipEntries: Record<string, Uint8Array> = {};

  for (const asset of cloned.assets) {
    if (!assetHasPackableMedia(asset)) {
      if (!isDefaultBackdrop(asset.id)) {
        stripAssetForManifest(asset);
      }
      continue;
    }

    const resolved = await resolveAssetBytes(project, asset);
    if (!resolved) {
      if (asset.path && isArchiveRelativePath(asset.path)) {
        stripAssetForManifest(asset);
        continue;
      }
      stripAssetForManifest(asset);
      continue;
    }

    const ext = extensionForMime(resolved.mime, defaultFallbackExtension(asset.type));
    const relativePath = assetArchivePath(asset.type, asset.id, ext);
    zipEntries[relativePath] = resolved.bytes;
    asset.path = relativePath;
    stripAssetForManifest(asset);
  }

  zipEntries[PROJECT_MANIFEST] = strToU8(serializeProject(cloned));
  return zipSync(zipEntries);
}

export interface UnpackedProjectArchive {
  manifest: string;
  files: Map<string, Uint8Array>;
}

export function unpackProjectArchive(data: Uint8Array): UnpackedProjectArchive {
  const entries = unzipSync(data);
  const manifestBytes = entries[PROJECT_MANIFEST];
  if (!manifestBytes) {
    throw new Error(`Invalid MLVN archive: missing ${PROJECT_MANIFEST}`);
  }

  const files = new Map<string, Uint8Array>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (name === PROJECT_MANIFEST) continue;
    if (name.startsWith("assets/")) {
      files.set(name, bytes);
    }
  }

  return {
    manifest: strFromU8(manifestBytes),
    files,
  };
}
