import type { Project, StoryGroup } from "./types";

export type StoryTreeStoryNode = {
  kind: "story";
  id: string;
  name: string;
};

export type StoryTreeGroupNode = {
  kind: "group";
  id: string;
  name: string;
  children: StoryTreeNode[];
};

export type StoryTreeNode = StoryTreeStoryNode | StoryTreeGroupNode;

export type StoryTreeSiblingKind = "story" | "group";

export type StoryTreeSibling = {
  kind: StoryTreeSiblingKind;
  id: string;
};

export type StoryTreePlacement = {
  parentGroupId?: string;
  index: number;
};

type StoryTreeSiblingEntry = StoryTreeSibling & {
  name: string;
  sortOrder: number | undefined;
};

function isDirectChildOf(parentGroupId: string | undefined, childGroupId: string | undefined): boolean {
  if (parentGroupId === undefined) {
    return childGroupId === undefined;
  }
  return childGroupId === parentGroupId;
}

function compareSiblingEntries(a: StoryTreeSiblingEntry, b: StoryTreeSiblingEntry): number {
  const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  if (a.kind !== b.kind) {
    return a.kind === "group" ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

export function getStoryGroups(project: Project): StoryGroup[] {
  return project.storyGroups ?? [];
}

export function collectDescendantGroupIds(groups: StoryGroup[], rootGroupId: string): string[] {
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

export function wouldCreateStoryGroupCycle(
  groups: StoryGroup[],
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

export function getStoryTreeSiblingEntries(
  project: Project,
  parentGroupId?: string
): StoryTreeSiblingEntry[] {
  const entries: StoryTreeSiblingEntry[] = [];

  for (const group of getStoryGroups(project)) {
    if (!isDirectChildOf(parentGroupId, group.parentGroupId)) continue;
    entries.push({
      kind: "group",
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
    });
  }

  for (const story of project.stories) {
    if (!isDirectChildOf(parentGroupId, story.groupId)) continue;
    entries.push({
      kind: "story",
      id: story.id,
      name: story.name,
      sortOrder: story.sortOrder,
    });
  }

  return entries.sort(compareSiblingEntries);
}

export function getStoryTreeSiblings(project: Project, parentGroupId?: string): StoryTreeSibling[] {
  return getStoryTreeSiblingEntries(project, parentGroupId).map(({ kind, id }) => ({ kind, id }));
}

export function nextStoryTreeSortOrder(project: Project, parentGroupId?: string): number {
  const siblings = getStoryTreeSiblingEntries(project, parentGroupId);
  if (siblings.length === 0) return 0;
  const lastOrder = siblings[siblings.length - 1]?.sortOrder;
  return lastOrder === undefined ? siblings.length : lastOrder + 1;
}

function assignSortOrders(project: Project, siblings: StoryTreeSibling[]): void {
  siblings.forEach((entry, index) => {
    if (entry.kind === "group") {
      const group = getStoryGroups(project).find((candidate) => candidate.id === entry.id);
      if (group) group.sortOrder = index;
      return;
    }
    const story = project.stories.find((candidate) => candidate.id === entry.id);
    if (story) story.sortOrder = index;
  });
}

export function ensureStoryTreeSortOrders(project: Project): void {
  const levels = new Set<string | undefined>([undefined]);
  for (const group of getStoryGroups(project)) {
    levels.add(group.id);
  }

  for (const parentGroupId of levels) {
    const entries = getStoryTreeSiblingEntries(project, parentGroupId);
    if (entries.length === 0) continue;
    if (entries.every((entry) => entry.sortOrder !== undefined)) continue;
    assignSortOrders(
      project,
      entries.map(({ kind, id }) => ({ kind, id }))
    );
  }
}

export function placeStoryInTree(
  project: Project,
  storyId: string,
  placement: StoryTreePlacement
): void {
  const story = project.stories.find((entry) => entry.id === storyId);
  if (!story) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const sourceParentGroupId = story.groupId;
  const sourceIndex = getStoryTreeSiblings(project, sourceParentGroupId).findIndex(
    (entry) => entry.kind === "story" && entry.id === storyId
  );

  if (placement.parentGroupId) {
    const group = getStoryGroups(project).find((entry) => entry.id === placement.parentGroupId);
    if (!group) {
      throw new Error(`Story group "${placement.parentGroupId}" not found`);
    }
    story.groupId = placement.parentGroupId;
  } else {
    delete story.groupId;
  }

  let targetIndex = placement.index;
  const sameParent = sourceParentGroupId === placement.parentGroupId;
  if (sameParent && sourceIndex !== -1 && sourceIndex < targetIndex) {
    targetIndex -= 1;
  }

  const siblings = getStoryTreeSiblings(project, placement.parentGroupId).filter(
    (entry) => !(entry.kind === "story" && entry.id === storyId)
  );
  const index = Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(index, 0, { kind: "story", id: storyId });
  assignSortOrders(project, siblings);
}

export function placeStoryGroupInTree(
  project: Project,
  groupId: string,
  placement: StoryTreePlacement
): void {
  const group = getStoryGroups(project).find((entry) => entry.id === groupId);
  if (!group) {
    throw new Error(`Story group "${groupId}" not found`);
  }

  const sourceParentGroupId = group.parentGroupId;
  const sourceIndex = getStoryTreeSiblings(project, sourceParentGroupId).findIndex(
    (entry) => entry.kind === "group" && entry.id === groupId
  );

  if (placement.parentGroupId) {
    if (placement.parentGroupId === groupId) {
      throw new Error("A story group cannot be its own parent");
    }
    const parent = getStoryGroups(project).find((entry) => entry.id === placement.parentGroupId);
    if (!parent) {
      throw new Error(`Story group "${placement.parentGroupId}" not found`);
    }
    if (wouldCreateStoryGroupCycle(getStoryGroups(project), groupId, placement.parentGroupId)) {
      throw new Error("Story group hierarchy cannot contain cycles");
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

  const siblings = getStoryTreeSiblings(project, placement.parentGroupId).filter(
    (entry) => !(entry.kind === "group" && entry.id === groupId)
  );
  const index = Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(index, 0, { kind: "group", id: groupId });
  assignSortOrders(project, siblings);
}

export function placeStoryTreeItem(
  project: Project,
  item: StoryTreeSibling,
  placement: StoryTreePlacement
): void {
  if (item.kind === "story") {
    placeStoryInTree(project, item.id, placement);
    return;
  }
  placeStoryGroupInTree(project, item.id, placement);
}

export function buildStoryTree(project: Project): StoryTreeNode[] {
  ensureStoryTreeSortOrders(project);

  function buildLevel(parentGroupId?: string): StoryTreeNode[] {
    return getStoryTreeSiblingEntries(project, parentGroupId).map((entry) => {
      if (entry.kind === "group") {
        return {
          kind: "group" as const,
          id: entry.id,
          name: entry.name,
          children: buildLevel(entry.id),
        };
      }
      return {
        kind: "story" as const,
        id: entry.id,
        name: entry.name,
      };
    });
  }

  return buildLevel(undefined);
}

export function normalizeStoryGroups(project: Project): void {
  const groups = getStoryGroups(project);
  if (groups.length === 0) {
    project.storyGroups = [];
  } else {
    project.storyGroups = groups;
  }

  const groupIds = new Set(getStoryGroups(project).map((group) => group.id));

  for (const group of getStoryGroups(project)) {
    if (group.parentGroupId && !groupIds.has(group.parentGroupId)) {
      delete group.parentGroupId;
    }
    if (group.parentGroupId === group.id) {
      delete group.parentGroupId;
    }
  }

  for (const story of project.stories) {
    if (story.groupId && !groupIds.has(story.groupId)) {
      delete story.groupId;
    }
  }

  ensureStoryTreeSortOrders(project);
}
