import type { Project } from "@/core/model/types";

export function collectAssetIdsFromProject(project: Project): Set<string> {
  return new Set(project.assets.map((asset) => asset.id));
}
