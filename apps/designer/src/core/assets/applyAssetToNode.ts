import type { Project, SceneAction, StoryNode } from "@/core/model/types";
import type { AssetDragData } from "@/utils/dragDrop";
import { getDefaultExpressionId } from "./actorExpressions";

export type AssetDropResult =
  | { kind: "nodePatch"; patch: Partial<Omit<StoryNode, "id">> }
  | { kind: "appendActions"; actions: SceneAction[] };

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "prop";
}

/** Instance id that does not collide with props already added in this scene. */
function uniquePropId(base: string, actions: SceneAction[]): string {
  const taken = new Set(
    actions.filter((action) => action.kind === "prop.add").map((action) => action.id)
  );
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

/**
 * Translate an asset drop onto a scene into either a node patch (sounds, which
 * are still node level) or scene actions appended to the scene script.
 */
export function assetDropForNode(
  project: Project,
  node: StoryNode,
  data: AssetDragData,
  actions: SceneAction[]
): AssetDropResult | null {
  switch (data.type) {
    case "backdrop":
      return { kind: "appendActions", actions: [{ kind: "bg.show", assetId: data.assetId }] };

    case "actor": {
      const actor = project.assets.find(
        (asset) => asset.id === data.assetId && asset.type === "actor"
      );
      if (!actor) return null;
      const id = uniquePropId(slugify(actor.name), actions);
      const variationId = data.expressionId ?? getDefaultExpressionId(actor);
      return {
        kind: "appendActions",
        actions: [
          { kind: "prop.add", id, assetId: data.assetId, variationId },
          { kind: "prop.show", id, position: { kind: "slot", slot: "Centre" } },
          { kind: "dialogue.show" },
        ],
      };
    }

    case "sound":
      return {
        kind: "nodePatch",
        patch: {
          soundConfigs: [
            ...(node.soundConfigs ?? []),
            {
              assetId: data.assetId,
              startOnLoad: false,
              stopOnLoad: false,
              loop: false,
            },
          ],
        },
      };
  }
}
