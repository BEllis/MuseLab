import type { Project } from "../model/types";

export interface AssetUsage {
  backdropScenes: number;
  actorScenes: number;
  soundSlots: number;
  total: number;
}

export function getAssetUsage(project: Project, assetId: string): AssetUsage {
  let backdropScenes = 0;
  let actorScenes = 0;
  let soundSlots = 0;

  for (const node of project.nodes) {
    if (node.backdropId === assetId) backdropScenes += 1;
    if (node.actorIds.includes(assetId)) actorScenes += 1;
    for (const config of node.soundConfigs) {
      if (config.assetId === assetId) soundSlots += 1;
    }
  }

  return {
    backdropScenes,
    actorScenes,
    soundSlots,
    total: backdropScenes + actorScenes + soundSlots,
  };
}
