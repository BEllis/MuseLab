import type { Project } from "../model/types";
import { isArchiveRelativePath, mimeFromExtension } from "../project/assetArchivePaths";
import { actorImageDataUrl, base64ToBlob } from "./actorImageSerialization";
import { DEFAULT_BACKDROP_ID } from "./defaultBackdrop";
import { putAssetBlob } from "./webAssetStorage";
import { isElectron } from "@/utils/isElectron";

const DEFAULT_IMAGE_MIME = "image/png";

function parseDataUrl(url: string): { mimeType: string; imageData: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageData: match[2] };
}

/** Load legacy embedded base64 media into web blob storage and strip from the live model. */
export async function hydrateLegacyEmbeddedAssets(project: Project): Promise<void> {
  for (const asset of project.assets) {
    if (asset.imageData) {
      const mime = asset.imageMimeType || DEFAULT_IMAGE_MIME;
      await putAssetBlob(asset.id, base64ToBlob(asset.imageData, mime));
      delete asset.imageData;
      delete asset.imageMimeType;
      if (asset.url?.startsWith("data:")) {
        delete asset.url;
      }
      asset.blobStored = true;
      continue;
    }

    if (asset.url?.startsWith("data:") && asset.id !== DEFAULT_BACKDROP_ID) {
      const parsed = parseDataUrl(asset.url);
      if (parsed) {
        await putAssetBlob(asset.id, base64ToBlob(parsed.imageData, parsed.mimeType));
        delete asset.url;
        asset.blobStored = true;
      }
    }
  }
}

export interface HydrateProjectAssetsOptions {
  files: Map<string, Uint8Array>;
  mlvnPath?: string | null;
}

/** Hydrate archive asset files into runtime storage. Returns Electron extract base dir when applicable. */
export async function hydrateProjectAssets(
  project: Project,
  options: HydrateProjectAssetsOptions
): Promise<string | null> {
  await hydrateLegacyEmbeddedAssets(project);

  const archiveAssets = project.assets.filter(
    (asset) => asset.path && isArchiveRelativePath(asset.path)
  );
  if (archiveAssets.length === 0) {
    return null;
  }

  if (isElectron() && window.electronAPI?.extractArchiveAssets) {
    const entries: { relativePath: string; data: Uint8Array }[] = [];
    for (const asset of archiveAssets) {
      const relativePath = asset.path!;
      const data = options.files.get(relativePath);
      if (!data) continue;
      entries.push({ relativePath, data });
    }

    if (entries.length === 0) {
      return null;
    }

    const cacheKey = options.mlvnPath ?? project.name;
    const baseDir = await window.electronAPI.extractArchiveAssets(cacheKey, entries);

    for (const asset of archiveAssets) {
      const relativePath = asset.path!;
      if (!options.files.has(relativePath)) continue;
      asset.path = joinAbsolutePath(baseDir, relativePath);
    }

    return baseDir;
  }

  for (const asset of archiveAssets) {
    const relativePath = asset.path!;
    const data = options.files.get(relativePath);
    if (!data) continue;

    const mime = mimeFromExtension(relativePath);
    await putAssetBlob(asset.id, new Blob([data], { type: mime }));
    delete asset.path;
    asset.blobStored = true;
  }

  return null;
}

function joinAbsolutePath(baseDir: string, relativePath: string): string {
  const normalizedBase = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRelative = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedRelative}`;
}

export function stripLegacyEmbeddedMedia(project: Project): void {
  for (const asset of project.assets) {
    if (asset.imageData) {
      delete asset.imageData;
      delete asset.imageMimeType;
    }
    if (asset.url?.startsWith("data:") && asset.id !== DEFAULT_BACKDROP_ID) {
      delete asset.url;
    }
  }
}

export { actorImageDataUrl };
