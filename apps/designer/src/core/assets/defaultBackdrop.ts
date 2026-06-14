import type { Project, Asset } from "../model/types";
import defaultBackdropDataUrl from "@/assets/default-backdrop.png?inline";

/** Stable id for the built-in 16:9 black backdrop (1920×1080). */
export const DEFAULT_BACKDROP_ID = "muselab-default-backdrop";

export function createDefaultBackdropAsset(): Asset {
  return {
    id: DEFAULT_BACKDROP_ID,
    type: "backdrop",
    name: "default",
    url: defaultBackdropDataUrl,
  };
}

/** Resolve a node's backdrop; missing or invalid selections fall back to "default". */
export function resolveBackdropId(
  project: Project,
  backdropId: string | null | undefined
): string {
  if (backdropId) {
    const asset = project.assets.find((a) => a.id === backdropId && a.type === "backdrop");
    if (asset) return backdropId;
  }
  return DEFAULT_BACKDROP_ID;
}

function defaultBackdropHasCustomMedia(asset: Asset): boolean {
  return Boolean(asset.path || asset.imageData || asset.blobStored);
}

/** Ensures every project has the default backdrop and nodes without one use it. */
export function ensureDefaultBackdrop(project: Project): void {
  const existing = project.assets.find((asset) => asset.id === DEFAULT_BACKDROP_ID);
  if (!existing) {
    project.assets.push(createDefaultBackdropAsset());
  } else {
    existing.name = "default";
    existing.type = "backdrop";
    if (
      !defaultBackdropHasCustomMedia(existing) &&
      (!existing.url || existing.url.startsWith("blob:"))
    ) {
      existing.url = defaultBackdropDataUrl;
    }
  }

  for (const story of project.stories) {
    for (const node of story.nodes) {
      node.backdropId = resolveBackdropId(project, node.backdropId);
    }
  }
}

export function isDefaultBackdrop(assetId: string): boolean {
  return assetId === DEFAULT_BACKDROP_ID;
}
