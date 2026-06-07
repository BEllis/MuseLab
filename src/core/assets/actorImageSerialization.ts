import type { Asset, Project } from "../model/types";
import { getAssetUrlAsync } from "./resolver";
import { getAssetBlob, putAssetBlob } from "./webAssetStorage";

const DEFAULT_ACTOR_MIME = "image/png";

export function actorImageDataUrl(asset: Asset): string | null {
  if (!asset.imageData) return null;
  const mime = asset.imageMimeType || DEFAULT_ACTOR_MIME;
  return `data:${mime};base64,${asset.imageData}`;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read image as base64"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function parseDataUrl(url: string): { mimeType: string; imageData: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageData: match[2] };
}

async function resolveActorBlob(project: Project, asset: Asset): Promise<Blob | null> {
  if (asset.imageData) {
    return base64ToBlob(asset.imageData, asset.imageMimeType || DEFAULT_ACTOR_MIME);
  }

  if (asset.url?.startsWith("data:")) {
    const parsed = parseDataUrl(asset.url);
    if (parsed) return base64ToBlob(parsed.imageData, parsed.mimeType);
  }

  const stored = await getAssetBlob(asset.id);
  if (stored) return stored;

  const url = await getAssetUrlAsync(project, asset.id);
  if (!url) return null;

  const response = await fetch(url);
  if (!response.ok) return null;
  return response.blob();
}

/** Return a project clone with actor image bytes embedded as base64 for JSON export. */
export async function embedActorImages(project: Project): Promise<Project> {
  const cloned = JSON.parse(JSON.stringify(project)) as Project;

  for (const asset of cloned.assets) {
    if (asset.type !== "actor") continue;
    if (asset.imageData) continue;

    if (asset.url?.startsWith("data:")) {
      const parsed = parseDataUrl(asset.url);
      if (parsed) {
        asset.imageMimeType = parsed.mimeType;
        asset.imageData = parsed.imageData;
        delete asset.url;
      }
      continue;
    }

    const blob = await resolveActorBlob(project, asset);
    if (!blob) continue;

    asset.imageMimeType = blob.type || DEFAULT_ACTOR_MIME;
    asset.imageData = await blobToBase64(blob);
  }

  return cloned;
}

/** Load embedded actor images into web blob storage and strip them from the live model. */
export async function hydrateActorImages(project: Project): Promise<void> {
  for (const asset of project.assets) {
    if (asset.type !== "actor" || !asset.imageData) continue;

    const mime = asset.imageMimeType || DEFAULT_ACTOR_MIME;
    await putAssetBlob(asset.id, base64ToBlob(asset.imageData, mime));
    delete asset.imageData;
    delete asset.imageMimeType;
    if (asset.url?.startsWith("data:")) {
      delete asset.url;
    }
  }
}
