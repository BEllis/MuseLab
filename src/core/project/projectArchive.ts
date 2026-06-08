import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Asset, AssetType, LocalePrompts } from "../model/types";
import {
  PROJECT_MANIFEST,
  assetArchivePath,
  extensionForMime,
  isArchiveRelativePath,
  promptsFileName,
} from "./assetArchivePaths";
import { serializeProject, parseProject, getFirstStoryId } from "../model/project";
import type { ProjectBundle } from "../model/projectBundle";
import { parseLocalePrompts, serializeLocalePrompts } from "../locale/prompts";
import { parseLocaleFromPromptsFileName, normalizeLocales } from "../locale/localeTag";
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
  bundle: ProjectBundle,
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

  const url = await getAssetUrlAsync(bundle.project, asset.id);
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

export async function packProjectArchive(bundle: ProjectBundle): Promise<Uint8Array> {
  const cloned = JSON.parse(JSON.stringify(bundle.project)) as ProjectBundle["project"];
  const zipEntries: Record<string, Uint8Array> = {};

  for (const asset of cloned.assets) {
    if (!assetHasPackableMedia(asset)) {
      if (!isDefaultBackdrop(asset.id)) {
        stripAssetForManifest(asset);
      }
      continue;
    }

    const resolved = await resolveAssetBytes(bundle, asset);
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

  for (const locale of normalizeLocales(cloned.locales)) {
    const prompts = bundle.promptsByLocale[locale] ?? { stories: {} };
    zipEntries[promptsFileName(locale)] = strToU8(serializeLocalePrompts(prompts));
  }

  return zipSync(zipEntries);
}

export interface UnpackedProjectArchive {
  manifest: string;
  files: Map<string, Uint8Array>;
  prompts: Map<string, LocalePrompts>;
}

export function unpackProjectArchive(data: Uint8Array): UnpackedProjectArchive {
  const entries = unzipSync(data);
  const manifestBytes = entries[PROJECT_MANIFEST];
  if (!manifestBytes) {
    throw new Error(`Invalid MLVN archive: missing ${PROJECT_MANIFEST}`);
  }

  const files = new Map<string, Uint8Array>();
  const prompts = new Map<string, LocalePrompts>();

  const manifest = strFromU8(manifestBytes);
  const defaultStoryId = getFirstStoryId(parseProject(manifest));

  for (const [name, bytes] of Object.entries(entries)) {
    if (name === PROJECT_MANIFEST) continue;

    const locale = parseLocaleFromPromptsFileName(name);
    if (locale) {
      prompts.set(locale, parseLocalePrompts(strFromU8(bytes), defaultStoryId));
      continue;
    }

    if (name.startsWith("assets/")) {
      files.set(name, bytes);
    }
  }

  return {
    manifest,
    files,
    prompts,
  };
}

export function assertArchivePromptLocales(
  projectLocales: string[],
  prompts: Map<string, LocalePrompts>
): void {
  const allowed = new Set(normalizeLocales(projectLocales));
  for (const locale of prompts.keys()) {
    if (!allowed.has(locale)) {
      throw new Error(
        `Invalid MLVN archive: prompts.${locale}.json is not listed in project.locales`
      );
    }
  }
}
