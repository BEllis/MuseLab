import type { SceneAction } from "./actions";

export type ActionAssetRole = "backdrop" | "prop" | "sound";

export type ActionAssetRef = {
  assetId: string;
  variationId?: string;
  role: ActionAssetRole;
};

/**
 * Every asset referenced by an action list.
 *
 * Scene actions are the only place backgrounds and characters are referenced now,
 * so asset usage counts, id migration, and cleanup all read through this.
 */
export function collectActionAssetRefs(actions: SceneAction[]): ActionAssetRef[] {
  const refs: ActionAssetRef[] = [];
  const propAssets = new Map<string, string>();

  for (const action of actions) {
    switch (action.kind) {
      case "bg.show":
      case "bg.fade":
      case "bg.slideIn":
        refs.push({ assetId: action.assetId, role: "backdrop" });
        break;
      case "prop.add":
        propAssets.set(action.id, action.assetId);
        refs.push({ assetId: action.assetId, variationId: action.variationId, role: "prop" });
        break;
      case "prop.setVariation": {
        const assetId = propAssets.get(action.id);
        if (assetId) {
          refs.push({ assetId, variationId: action.variationId, role: "prop" });
        }
        break;
      }
      case "playSound":
        refs.push({ assetId: action.assetId, role: "sound" });
        break;
      default:
        break;
    }
  }

  return refs;
}

/** Rewrite asset and variation ids in place, used by the UUID id migration. */
export function remapActionAssetIds(
  actions: SceneAction[],
  idMap: Map<string, string>
): SceneAction[] {
  const remap = (id: string): string => idMap.get(id) ?? id;
  return actions.map((action) => {
    switch (action.kind) {
      case "bg.show":
      case "bg.fade":
      case "bg.slideIn":
        return { ...action, assetId: remap(action.assetId) };
      case "prop.add":
        return {
          ...action,
          assetId: remap(action.assetId),
          ...(action.variationId ? { variationId: remap(action.variationId) } : {}),
        };
      case "prop.setVariation":
        return { ...action, variationId: remap(action.variationId) };
      case "playSound":
        return { ...action, assetId: remap(action.assetId) };
      default:
        return action;
    }
  });
}

/** Ids that the UUID migration must consider when scanning action lists. */
export function collectActionMigratableIds(
  actions: SceneAction[],
  needsMigration: (id: string) => boolean,
  into: Set<string>
): void {
  for (const ref of collectActionAssetRefs(actions)) {
    if (ref.assetId && needsMigration(ref.assetId)) into.add(ref.assetId);
    if (ref.variationId && needsMigration(ref.variationId)) into.add(ref.variationId);
  }
}
