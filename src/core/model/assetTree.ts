import { DEFAULT_BACKDROP_ID } from "../assets/defaultBackdrop";
import { getDefaultExpressionId } from "../assets/actorExpressions";
import type { ActorExpression, Asset, AssetGroup, AssetType, Project } from "./types";

export type AssetTreeExpressionNode = {
  kind: "expression";
  id: string;
  actorId: string;
  name: string;
  isDefault: boolean;
};

export type AssetTreeAssetNode = {
  kind: "asset";
  id: string;
  name: string;
  assetType: AssetType;
  expressions: AssetTreeExpressionNode[];
};

export type AssetTreeGroupNode = {
  kind: "group";
  id: string;
  name: string;
  children: AssetTreeNode[];
};

export type AssetTreeNode = AssetTreeGroupNode | AssetTreeAssetNode;

export type AssetTreeSiblingKind = "group" | "asset" | "expression";

export type AssetTreeSibling =
  | { kind: "group"; id: string }
  | { kind: "asset"; id: string }
  | { kind: "expression"; actorId: string; id: string };

export type AssetTreePlacement = {
  assetType: AssetType;
  parentGroupId?: string;
  parentActorId?: string;
  index: number;
};

type AssetTreeSiblingEntry = {
  kind: AssetTreeSiblingKind;
  id: string;
  name: string;
  sortOrder: number | undefined;
  actorId?: string;
};

function isDirectChildOf(parentGroupId: string | undefined, childGroupId: string | undefined): boolean {
  if (parentGroupId === undefined) {
    return childGroupId === undefined;
  }
  return childGroupId === parentGroupId;
}

function compareSiblingEntries(a: AssetTreeSiblingEntry, b: AssetTreeSiblingEntry): number {
  const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  if (a.kind !== b.kind) {
    return a.kind === "group" ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

export function getAssetGroups(project: Project): AssetGroup[] {
  return project.assetGroups ?? [];
}

export function getAssetGroupsForType(project: Project, assetType: AssetType): AssetGroup[] {
  return getAssetGroups(project).filter((group) => group.assetType === assetType);
}

export function collectDescendantAssetGroupIds(
  groups: AssetGroup[],
  rootGroupId: string
): string[] {
  const descendants: string[] = [];
  const queue = groups
    .filter((group) => group.parentGroupId === rootGroupId)
    .map((group) => group.id);

  while (queue.length > 0) {
    const groupId = queue.shift();
    if (!groupId) continue;
    descendants.push(groupId);
    for (const child of groups) {
      if (child.parentGroupId === groupId) {
        queue.push(child.id);
      }
    }
  }

  return descendants;
}

export function wouldCreateAssetGroupCycle(
  groups: AssetGroup[],
  groupId: string,
  newParentGroupId: string
): boolean {
  let current: string | undefined = newParentGroupId;
  while (current) {
    if (current === groupId) return true;
    current = groups.find((group) => group.id === current)?.parentGroupId;
  }
  return false;
}

function isTreeAsset(asset: Asset, assetType: AssetType, parentGroupId?: string): boolean {
  if (asset.type !== assetType) return false;
  if (assetType === "backdrop" && asset.id === DEFAULT_BACKDROP_ID && parentGroupId === undefined) {
    return false;
  }
  return isDirectChildOf(parentGroupId, asset.groupId);
}

export function getAssetTreeSiblingEntries(
  project: Project,
  assetType: AssetType,
  parentGroupId?: string
): AssetTreeSiblingEntry[] {
  const groups = getAssetGroupsForType(project, assetType);
  const entries: AssetTreeSiblingEntry[] = [];

  for (const group of groups) {
    if (!isDirectChildOf(parentGroupId, group.parentGroupId)) continue;
    entries.push({
      kind: "group",
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
    });
  }

  for (const asset of project.assets) {
    if (!isTreeAsset(asset, assetType, parentGroupId)) continue;
    entries.push({
      kind: "asset",
      id: asset.id,
      name: asset.name,
      sortOrder: asset.sortOrder,
    });
  }

  return entries.sort(compareSiblingEntries);
}

export function getAssetTreeSiblings(
  project: Project,
  assetType: AssetType,
  parentGroupId?: string
): AssetTreeSibling[] {
  return getAssetTreeSiblingEntries(project, assetType, parentGroupId).map((entry) => {
    if (entry.kind === "expression") {
      return { kind: entry.kind, id: entry.id, actorId: entry.actorId! };
    }
    return { kind: entry.kind, id: entry.id };
  });
}

export function getExpressionSiblingEntries(project: Project, actorId: string): AssetTreeSiblingEntry[] {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset?.expressions) return [];

  return asset.expressions
    .map((expression) => ({
      kind: "expression" as const,
      actorId,
      id: expression.id,
      name: expression.name,
      sortOrder: expression.sortOrder,
    }))
    .sort(compareSiblingEntries);
}

export function getExpressionSiblings(project: Project, actorId: string): AssetTreeSibling[] {
  return getExpressionSiblingEntries(project, actorId).map((entry) => ({
    kind: entry.kind,
    id: entry.id,
    actorId: entry.actorId!,
  }));
}

/** Actor expressions in the same order as the asset tree. */
export function getSortedActorExpressions(project: Project, actorId: string): ActorExpression[] {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset?.expressions?.length) return [];
  const byId = new Map(asset.expressions.map((expression) => [expression.id, expression]));
  return getExpressionSiblingEntries(project, actorId)
    .map((entry) => byId.get(entry.id))
    .filter((expression): expression is ActorExpression => expression != null);
}

export function nextAssetTreeSortOrder(
  project: Project,
  assetType: AssetType,
  parentGroupId?: string
): number {
  const siblings = getAssetTreeSiblingEntries(project, assetType, parentGroupId);
  if (siblings.length === 0) return 0;
  const lastOrder = siblings[siblings.length - 1]?.sortOrder;
  return lastOrder === undefined ? siblings.length : lastOrder + 1;
}

export function nextExpressionSortOrder(project: Project, actorId: string): number {
  const siblings = getExpressionSiblingEntries(project, actorId);
  if (siblings.length === 0) return 0;
  const lastOrder = siblings[siblings.length - 1]?.sortOrder;
  return lastOrder === undefined ? siblings.length : lastOrder + 1;
}

function assignAssetTreeSortOrders(
  project: Project,
  assetType: AssetType,
  siblings: AssetTreeSibling[]
): void {
  const groups = getAssetGroupsForType(project, assetType);
  siblings.forEach((entry, index) => {
    if (entry.kind === "group") {
      const group = groups.find((candidate) => candidate.id === entry.id);
      if (group) group.sortOrder = index;
      return;
    }
    if (entry.kind === "asset") {
      const asset = project.assets.find((candidate) => candidate.id === entry.id);
      if (asset) asset.sortOrder = index;
    }
  });
}

function assignExpressionSortOrders(project: Project, actorId: string, siblings: AssetTreeSibling[]): void {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset?.expressions) return;

  siblings.forEach((entry, index) => {
    if (entry.kind !== "expression") return;
    const expression = asset.expressions?.find((candidate) => candidate.id === entry.id);
    if (expression) expression.sortOrder = index;
  });
}

export function ensureAssetTreeSortOrders(project: Project): void {
  for (const assetType of ["backdrop", "actor", "sound"] as const) {
    const groups = getAssetGroupsForType(project, assetType);
    const levels = new Set<string | undefined>([undefined]);
    for (const group of groups) {
      levels.add(group.id);
    }

    for (const parentGroupId of levels) {
      const entries = getAssetTreeSiblingEntries(project, assetType, parentGroupId);
      if (entries.length === 0) continue;
      if (entries.every((entry) => entry.sortOrder !== undefined)) continue;
      assignAssetTreeSortOrders(
        project,
        assetType,
        entries.map((entry) =>
          entry.kind === "expression"
            ? { kind: entry.kind, id: entry.id, actorId: entry.actorId! }
            : { kind: entry.kind, id: entry.id }
        )
      );
    }
  }
}

export function ensureExpressionSortOrders(project: Project): void {
  for (const asset of project.assets) {
    if (asset.type !== "actor") continue;
    const entries = getExpressionSiblingEntries(project, asset.id);
    if (entries.length === 0) continue;
    if (entries.every((entry) => entry.sortOrder !== undefined)) continue;
    assignExpressionSortOrders(
      project,
      asset.id,
      entries.map((entry) => ({ kind: entry.kind, id: entry.id, actorId: entry.actorId! }))
    );
  }
}

export function placeAssetInTree(
  project: Project,
  assetId: string,
  placement: AssetTreePlacement
): void {
  if (placement.parentActorId) {
    throw new Error("Assets cannot be placed under an actor");
  }

  const asset = project.assets.find((entry) => entry.id === assetId);
  if (!asset) {
    throw new Error(`Asset "${assetId}" not found`);
  }
  if (asset.type !== placement.assetType) {
    throw new Error(`Asset "${assetId}" is not a ${placement.assetType}`);
  }
  if (asset.id === DEFAULT_BACKDROP_ID) {
    throw new Error("The default backdrop cannot be moved");
  }

  const sourceParentGroupId = asset.groupId;
  const sourceIndex = getAssetTreeSiblings(project, placement.assetType, sourceParentGroupId).findIndex(
    (entry) => entry.kind === "asset" && entry.id === assetId
  );

  if (placement.parentGroupId) {
    const group = getAssetGroupsForType(project, placement.assetType).find(
      (entry) => entry.id === placement.parentGroupId
    );
    if (!group) {
      throw new Error(`Asset group "${placement.parentGroupId}" not found`);
    }
    asset.groupId = placement.parentGroupId;
  } else {
    delete asset.groupId;
  }

  let targetIndex = placement.index;
  const sameParent = sourceParentGroupId === placement.parentGroupId;
  if (sameParent && sourceIndex !== -1 && sourceIndex < targetIndex) {
    targetIndex -= 1;
  }

  const siblings = getAssetTreeSiblings(project, placement.assetType, placement.parentGroupId).filter(
    (entry) => !(entry.kind === "asset" && entry.id === assetId)
  );
  const index = Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(index, 0, { kind: "asset", id: assetId });
  assignAssetTreeSortOrders(project, placement.assetType, siblings);
}

export function placeAssetGroupInTree(
  project: Project,
  groupId: string,
  placement: AssetTreePlacement
): void {
  if (placement.parentActorId) {
    throw new Error("Asset groups cannot be placed under an actor");
  }

  const groups = getAssetGroupsForType(project, placement.assetType);
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) {
    throw new Error(`Asset group "${groupId}" not found`);
  }

  const sourceParentGroupId = group.parentGroupId;
  const sourceIndex = getAssetTreeSiblings(project, placement.assetType, sourceParentGroupId).findIndex(
    (entry) => entry.kind === "group" && entry.id === groupId
  );

  if (placement.parentGroupId) {
    if (placement.parentGroupId === groupId) {
      throw new Error("An asset group cannot be its own parent");
    }
    const parent = groups.find((entry) => entry.id === placement.parentGroupId);
    if (!parent) {
      throw new Error(`Asset group "${placement.parentGroupId}" not found`);
    }
    if (wouldCreateAssetGroupCycle(groups, groupId, placement.parentGroupId)) {
      throw new Error("Asset group hierarchy cannot contain cycles");
    }
    group.parentGroupId = placement.parentGroupId;
  } else {
    delete group.parentGroupId;
  }

  let targetIndex = placement.index;
  const sameParent = sourceParentGroupId === placement.parentGroupId;
  if (sameParent && sourceIndex !== -1 && sourceIndex < targetIndex) {
    targetIndex -= 1;
  }

  const siblings = getAssetTreeSiblings(project, placement.assetType, placement.parentGroupId).filter(
    (entry) => !(entry.kind === "group" && entry.id === groupId)
  );
  const index = Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(index, 0, { kind: "group", id: groupId });
  assignAssetTreeSortOrders(project, placement.assetType, siblings);
}

export function placeExpressionInTree(
  project: Project,
  actorId: string,
  expressionId: string,
  index: number
): void {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset) {
    throw new Error(`Actor "${actorId}" not found`);
  }
  const expression = asset.expressions?.find((entry) => entry.id === expressionId);
  if (!expression) {
    throw new Error(`Expression "${expressionId}" not found`);
  }

  const sourceIndex = getExpressionSiblings(project, actorId).findIndex(
    (entry) => entry.kind === "expression" && entry.id === expressionId
  );

  let targetIndex = index;
  if (sourceIndex !== -1 && sourceIndex < targetIndex) {
    targetIndex -= 1;
  }

  const siblings = getExpressionSiblings(project, actorId).filter(
    (entry) => !(entry.kind === "expression" && entry.id === expressionId)
  );
  const clampedIndex = Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(clampedIndex, 0, { kind: "expression", actorId, id: expressionId });
  assignExpressionSortOrders(project, actorId, siblings);
}

export function placeAssetTreeItem(
  project: Project,
  item: AssetTreeSibling,
  placement: AssetTreePlacement
): void {
  if (item.kind === "expression") {
    if (placement.parentActorId !== item.actorId) {
      throw new Error("Expressions can only be reordered within their actor");
    }
    placeExpressionInTree(project, item.actorId, item.id, placement.index);
    return;
  }
  if (item.kind === "asset") {
    placeAssetInTree(project, item.id, placement);
    return;
  }
  placeAssetGroupInTree(project, item.id, placement);
}

function buildExpressionNodes(project: Project, actor: Asset): AssetTreeExpressionNode[] {
  const defaultExpressionId = getDefaultExpressionId(actor);
  return getExpressionSiblingEntries(project, actor.id).map((entry) => ({
    kind: "expression" as const,
    id: entry.id,
    actorId: actor.id,
    name: entry.name,
    isDefault: entry.id === defaultExpressionId,
  }));
}

function buildAssetTypeLevel(
  project: Project,
  assetType: AssetType,
  parentGroupId?: string
): AssetTreeNode[] {
  return getAssetTreeSiblingEntries(project, assetType, parentGroupId).map((entry) => {
    if (entry.kind === "group") {
      return {
        kind: "group" as const,
        id: entry.id,
        name: entry.name,
        children: buildAssetTypeLevel(project, assetType, entry.id),
      };
    }

    const asset = project.assets.find((candidate) => candidate.id === entry.id);
    if (!asset) {
      throw new Error(`Asset "${entry.id}" not found`);
    }

    return {
      kind: "asset" as const,
      id: entry.id,
      name: entry.name,
      assetType,
      expressions: assetType === "actor" ? buildExpressionNodes(project, asset) : [],
    };
  });
}

export function buildAssetTreeForType(project: Project, assetType: AssetType): AssetTreeNode[] {
  ensureAssetTreeSortOrders(project);
  if (assetType === "actor") {
    ensureExpressionSortOrders(project);
  }
  return buildAssetTypeLevel(project, assetType, undefined);
}

export function normalizeAssetGroups(project: Project): void {
  const groups = getAssetGroups(project);
  if (groups.length === 0) {
    project.assetGroups = [];
  } else {
    project.assetGroups = groups;
  }

  const groupIds = new Set(getAssetGroups(project).map((group) => group.id));

  for (const group of getAssetGroups(project)) {
    if (group.parentGroupId && !groupIds.has(group.parentGroupId)) {
      delete group.parentGroupId;
    }
    if (group.parentGroupId === group.id) {
      delete group.parentGroupId;
    }
  }

  for (const asset of project.assets) {
    if (asset.groupId && !groupIds.has(asset.groupId)) {
      delete asset.groupId;
    }
    if (asset.groupId) {
      const group = getAssetGroups(project).find((entry) => entry.id === asset.groupId);
      if (group && group.assetType !== asset.type) {
        delete asset.groupId;
      }
    }
  }

  ensureAssetTreeSortOrders(project);
  ensureExpressionSortOrders(project);
}
