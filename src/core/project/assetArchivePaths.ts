import type { AssetType } from "../model/types";

export const PROJECT_MANIFEST = "project.json";

export function promptsFileName(locale: string): string {
  return `prompts.${locale}.json`;
}

const ASSET_TYPE_DIRS: Record<AssetType, string> = {
  backdrop: "backdrops",
  actor: "actors",
  sound: "sounds",
  font: "fonts",
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "font/woff2": ".woff2",
  "font/woff": ".woff",
  "font/ttf": ".ttf",
  "font/otf": ".otf",
  "application/font-woff2": ".woff2",
  "application/font-woff": ".woff",
  "application/x-font-ttf": ".ttf",
  "application/x-font-opentype": ".otf",
};

const EXTENSION_MIMES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export function assetArchivePath(type: AssetType, assetId: string, ext: string): string {
  const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `assets/${ASSET_TYPE_DIRS[type]}/${assetId}${normalizedExt}`;
}

export function extensionForMime(mime: string, fallback = ".bin"): string {
  const normalized = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_EXTENSIONS[normalized] ?? fallback;
}

export function mimeFromExtension(filePath: string, fallback = "application/octet-stream"): string {
  const dot = filePath.lastIndexOf(".");
  if (dot < 0) return fallback;
  const ext = filePath.slice(dot).toLowerCase();
  return EXTENSION_MIMES[ext] ?? fallback;
}

export function isArchiveRelativePath(filePath: string): boolean {
  return filePath.startsWith("assets/") && !filePath.includes("..");
}
