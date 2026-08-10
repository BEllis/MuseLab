import type { PromptsByLocale } from "../locale/prompts";
import type { Project } from "../model/types";
import { collectActionAssetRefs } from "../scene/actionAssets";

export interface AssetUsage {
  backdropScenes: number;
  actorScenes: number;
  soundSlots: number;
  total: number;
}

/**
 * Count scenes referencing an asset.
 *
 * Backgrounds and props live in scripted actions, so a scene counts once even
 * when several of its actions touch the same asset, and only the default locale
 * is scanned because action lists are authored per locale but share assets.
 */
export function getAssetUsage(
  project: Project,
  assetId: string,
  promptsByLocale: PromptsByLocale = {}
): AssetUsage {
  let backdropScenes = 0;
  let actorScenes = 0;
  let soundSlots = 0;

  for (const story of project.stories) {
    for (const node of story.nodes) {
      for (const config of node.soundConfigs ?? []) {
        if (config.assetId === assetId) soundSlots += 1;
      }
    }
  }

  const seenScenes = new Set<string>();
  for (const prompts of Object.values(promptsByLocale)) {
    for (const [storyId, storyPrompts] of Object.entries(prompts.stories)) {
      for (const [nodeId, entry] of Object.entries(storyPrompts.nodes)) {
        const sceneKey = `${storyId}:${nodeId}`;
        if (seenScenes.has(sceneKey)) continue;
        const refs = collectActionAssetRefs(entry.actions ?? []).filter(
          (ref) => ref.assetId === assetId
        );
        if (refs.length === 0) continue;
        seenScenes.add(sceneKey);
        if (refs.some((ref) => ref.role === "backdrop")) backdropScenes += 1;
        if (refs.some((ref) => ref.role === "prop")) actorScenes += 1;
        if (refs.some((ref) => ref.role === "sound")) soundSlots += 1;
      }
    }
  }

  return {
    backdropScenes,
    actorScenes,
    soundSlots,
    total: backdropScenes + actorScenes + soundSlots,
  };
}
