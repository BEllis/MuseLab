import type { StoryNode } from "@/core/model/types";
import type { AssetDragData } from "@/utils/dragDrop";

/** Returns a node patch when the asset applies; null when there is nothing to change. */
export function patchNodeForAssetDrop(
  node: StoryNode,
  data: AssetDragData
): Partial<Omit<StoryNode, "id">> | null {
  switch (data.type) {
    case "backdrop":
      if (node.backdropId === data.assetId) return null;
      return { backdropId: data.assetId };
    case "actor": {
      const actorIds = node.actorIds ?? [];
      if (actorIds.includes(data.assetId)) return null;
      return { actorIds: [...actorIds, data.assetId] };
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
