import type { ActorExpression, Project } from "../model/types";
import { isArchiveRelativePath, mimeFromExtension } from "../project/assetArchivePaths";
import {
  actorImageDataUrl,
  base64ToBlob,
  expressionImageDataUrl,
} from "./actorImageSerialization";
import {
  ensureAllActorExpressions,
  expressionBlobKey,
  PLACEHOLDER_EXPRESSION_URL,
} from "./actorExpressions";
import { DEFAULT_BACKDROP_ID } from "./defaultBackdrop";
import { getAssetBlob, putAssetBlob } from "./webAssetStorage";
import { isElectron } from "@/utils/isElectron";

const DEFAULT_IMAGE_MIME = "image/png";

function parseDataUrl(url: string): { mimeType: string; imageData: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageData: match[2] };
}

async function hydrateExpressionMedia(
  actorId: string,
  expression: ActorExpression
): Promise<void> {
  const blobKey = expressionBlobKey(actorId, expression.id);

  if (expression.imageData) {
    const mime = expression.imageMimeType || DEFAULT_IMAGE_MIME;
    await putAssetBlob(blobKey, base64ToBlob(expression.imageData, mime));
    delete expression.imageData;
    delete expression.imageMimeType;
    if (expression.url?.startsWith("data:")) {
      delete expression.url;
    }
    expression.blobStored = true;
    return;
  }

  if (expression.url?.startsWith("data:") && expression.url !== PLACEHOLDER_EXPRESSION_URL) {
    const parsed = parseDataUrl(expression.url);
    if (parsed) {
      await putAssetBlob(blobKey, base64ToBlob(parsed.imageData, parsed.mimeType));
      delete expression.url;
      expression.blobStored = true;
    }
  }
}

async function migrateLegacyActorBlob(actorId: string, defaultExpressionId: string): Promise<void> {
  const legacyBlob = await getAssetBlob(actorId);
  if (!legacyBlob) return;
  await putAssetBlob(expressionBlobKey(actorId, defaultExpressionId), legacyBlob);
}

/** Load legacy embedded base64 media into web blob storage and strip from the live model. */
export async function hydrateLegacyEmbeddedAssets(project: Project): Promise<void> {
  ensureAllActorExpressions(project);

  for (const asset of project.assets) {
    if (asset.type === "actor") {
      for (const expression of asset.expressions ?? []) {
        await hydrateExpressionMedia(asset.id, expression);
      }
      if (asset.expressions?.[0]) {
        await migrateLegacyActorBlob(asset.id, asset.expressions[0].id);
      }
      continue;
    }

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

function collectArchiveRelativePaths(project: Project): Array<{
  actorId?: string;
  expression?: ActorExpression;
  assetId?: string;
  relativePath: string;
}> {
  const entries: Array<{
    actorId?: string;
    expression?: ActorExpression;
    assetId?: string;
    relativePath: string;
  }> = [];

  for (const asset of project.assets) {
    if (asset.type === "actor") {
      for (const expression of asset.expressions ?? []) {
        if (expression.path && isArchiveRelativePath(expression.path)) {
          entries.push({
            actorId: asset.id,
            expression,
            relativePath: expression.path,
          });
        }
      }
      continue;
    }

    if (asset.path && isArchiveRelativePath(asset.path)) {
      entries.push({ assetId: asset.id, relativePath: asset.path });
    }
  }

  return entries;
}

/** Hydrate archive asset files into runtime storage. Returns Electron extract base dir when applicable. */
export async function hydrateProjectAssets(
  project: Project,
  options: HydrateProjectAssetsOptions
): Promise<string | null> {
  await hydrateLegacyEmbeddedAssets(project);

  const archiveEntries = collectArchiveRelativePaths(project);
  if (archiveEntries.length === 0) {
    return null;
  }

  if (isElectron() && window.electronAPI?.extractArchiveAssets) {
    const entries: { relativePath: string; data: Uint8Array }[] = [];
    for (const entry of archiveEntries) {
      const data = options.files.get(entry.relativePath);
      if (!data) continue;
      entries.push({ relativePath: entry.relativePath, data });
    }

    if (entries.length === 0) {
      return null;
    }

    const cacheKey = options.mlvnPath ?? project.name;
    const baseDir = await window.electronAPI.extractArchiveAssets(cacheKey, entries);

    for (const entry of archiveEntries) {
      if (!options.files.has(entry.relativePath)) continue;
      const absolutePath = joinAbsolutePath(baseDir, entry.relativePath);
      if (entry.expression) {
        entry.expression.path = absolutePath;
      } else if (entry.assetId) {
        const asset = project.assets.find((a) => a.id === entry.assetId);
        if (asset) asset.path = absolutePath;
      }
    }

    return baseDir;
  }

  for (const entry of archiveEntries) {
    const data = options.files.get(entry.relativePath);
    if (!data) continue;

    const mime = mimeFromExtension(entry.relativePath);
    const blob = new Blob([data], { type: mime });

    if (entry.expression && entry.actorId) {
      await putAssetBlob(expressionBlobKey(entry.actorId, entry.expression.id), blob);
      delete entry.expression.path;
      entry.expression.blobStored = true;
      continue;
    }

    if (entry.assetId) {
      await putAssetBlob(entry.assetId, blob);
      const asset = project.assets.find((a) => a.id === entry.assetId);
      if (asset) {
        delete asset.path;
        asset.blobStored = true;
      }
    }
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
    if (asset.type === "actor") {
      for (const expression of asset.expressions ?? []) {
        if (expression.imageData) {
          delete expression.imageData;
          delete expression.imageMimeType;
        }
        if (expression.url?.startsWith("data:") && expression.url !== PLACEHOLDER_EXPRESSION_URL) {
          delete expression.url;
        }
      }
      continue;
    }

    if (asset.imageData) {
      delete asset.imageData;
      delete asset.imageMimeType;
    }
    if (asset.url?.startsWith("data:") && asset.id !== DEFAULT_BACKDROP_ID) {
      delete asset.url;
    }
  }
}

export { actorImageDataUrl, expressionImageDataUrl };
