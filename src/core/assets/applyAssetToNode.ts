import type { Project, StoryNode } from "@/core/model/types";
import type { AssetDragData } from "@/utils/dragDrop";
import { getDefaultExpressionId } from "./actorExpressions";

/** Returns a node patch when the asset applies; null when there is nothing to change. */
export function patchNodeForAssetDrop(
  project: Project,
  node: StoryNode,
  data: AssetDragData
): Partial<Omit<StoryNode, "id">> | null {
  switch (data.type) {
    case "backdrop":
      if (node.backdropId === data.assetId) return null;
      return { backdropId: data.assetId };
    case "actor": {
      const actorConfigs = node.actorConfigs ?? [];
      if (actorConfigs.some((config) => config.assetId === data.assetId)) return null;
      const actor = project.assets.find((asset) => asset.id === data.assetId && asset.type === "actor");
      if (!actor) return null;
      return {
        actorConfigs: [
          ...actorConfigs,
          { assetId: data.assetId, expressionId: data.expressionId ?? getDefaultExpressionId(actor) },
        ],
      };
    }
    case "sound":
      return {
        soundConfigs: [
          ...(node.soundConfigs ?? []),
          {
            assetId: data.assetId,
            startOnLoad: false,
            stopOnLoad: false,
            loop: false,
          },
        ],
      };
  }
}
