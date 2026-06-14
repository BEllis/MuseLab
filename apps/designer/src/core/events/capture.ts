import type { Project } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
import { getNodeSpeaker, getNodeTextTemplate } from "@/core/locale/prompts";
import { getStory, getStoryGroup, getAssetGroup } from "@/core/model/project";
import { collectDescendantGroupIds, getStoryGroups } from "@/core/model/storyTree";
import { collectDescendantAssetGroupIds, getAssetGroups, getAssetGroupsForType } from "@/core/model/assetTree";
import type { Asset } from "@/core/model/types";
import type {
  AppEvent,
  AssetGroupPatch,
  AssetPatch,
  NodePatch,
  StoryGroupPatch,
  StoryPatch,
} from "./types";
import {
  createEventMeta,
  getNavigationSnapshot,
  getSelectionSnapshot,
  type AppState,
} from "./appState";
import type {
  EdgePromptValue,
  NodePromptValue,
  ProjectPatch,
  RemoveEdgePayload,
  RemoveNodePayload,
  RemoveStoryPayload,
} from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Clone a patch field for event `before` state; undefined becomes null so undo survives JSON persistence. */
export function capturePatchValue<T>(value: T | undefined): T | null {
  return value === undefined ? null : clone(value);
}

export function captureProjectPatch(
  project: Project,
  patch: ProjectPatch
): ProjectPatch {
  const before: ProjectPatch = {};
  for (const key of Object.keys(patch) as Array<keyof ProjectPatch>) {
    if (key === "attributes") {
      before.attributes = capturePatchValue(project.attributes) as never;
      continue;
    }
    before[key] = capturePatchValue(project[key]) as never;
  }
  return before;
}

export function captureNodePatch(
  project: Project,
  storyId: string,
  nodeId: string,
  patch: NodePatch
): NodePatch {
  const node = getStory(project, storyId).nodes.find((entry) => entry.id === nodeId);
  if (!node) return {};
  const before: NodePatch = {};
  for (const key of Object.keys(patch) as Array<keyof NodePatch>) {
    if (key === "attributes") {
      before.attributes = capturePatchValue(node.attributes) as never;
      continue;
    }
    const value = node[key];
    if (value !== undefined) {
      before[key] = clone(value) as never;
    }
  }
  return before;
}

export function captureStoryPatch(
  project: Project,
  storyId: string,
  patch: StoryPatch
): StoryPatch {
  const story = getStory(project, storyId);
  const before: StoryPatch = {};
  for (const key of Object.keys(patch) as Array<keyof StoryPatch>) {
    if (key === "groupId") {
      before.groupId = story.groupId;
      continue;
    }
    if (key === "sortOrder") {
      before.sortOrder = story.sortOrder;
      continue;
    }
    if (key === "attributes") {
      before.attributes = capturePatchValue(story.attributes) as never;
      continue;
    }
    before[key] = clone(story[key]) as never;
  }
  return before;
}

export function captureStoryGroupPatch(
  project: Project,
  groupId: string,
  patch: import("./types").StoryGroupPatch
): import("./types").StoryGroupPatch {
  const group = getStoryGroup(project, groupId);
  const before: import("./types").StoryGroupPatch = {};
  for (const key of Object.keys(patch) as Array<keyof import("./types").StoryGroupPatch>) {
    if (key === "parentGroupId") {
      before.parentGroupId = group.parentGroupId;
      continue;
    }
    if (key === "sortOrder") {
      before.sortOrder = group.sortOrder;
      continue;
    }
    before[key] = clone(group[key]) as never;
  }
  return before;
}

export function captureRemoveStoryGroupPayload(
  project: Project,
  groupId: string
): import("./types").RemoveStoryGroupPayload {
  const groups = getStoryGroups(project);
  const descendantIds = collectDescendantGroupIds(groups, groupId);
  const removedGroupIds = new Set([groupId, ...descendantIds]);
  const removedGroups = groups.filter((group) => removedGroupIds.has(group.id)).map(clone);
  const storyAssignments = project.stories
    .filter((story) => story.groupId && removedGroupIds.has(story.groupId))
    .map((story) => ({ storyId: story.id, groupId: story.groupId }));

  return {
    rootGroupId: groupId,
    groups: removedGroups,
    storyAssignments,
  };
}

export function buildStoryTreeMoveEvents(before: Project, after: Project): AppEvent[] {
  const events: AppEvent[] = [];

  for (const story of after.stories) {
    const prev = before.stories.find((entry) => entry.id === story.id);
    if (!prev) continue;
    const patch: StoryPatch = {};
    if (prev.groupId !== story.groupId) patch.groupId = story.groupId;
    if (prev.sortOrder !== story.sortOrder) patch.sortOrder = story.sortOrder;
    if (Object.keys(patch).length === 0) continue;
    events.push({
      ...createEventMeta(),
      type: "updateStory",
      storyId: story.id,
      before: captureStoryPatch(before, story.id, patch),
      after: patch,
    });
  }

  for (const group of getStoryGroups(after)) {
    const prev = getStoryGroups(before).find((entry) => entry.id === group.id);
    if (!prev) continue;
    const patch: StoryGroupPatch = {};
    if (prev.parentGroupId !== group.parentGroupId) patch.parentGroupId = group.parentGroupId;
    if (prev.sortOrder !== group.sortOrder) patch.sortOrder = group.sortOrder;
    if (Object.keys(patch).length === 0) continue;
    events.push({
      ...createEventMeta(),
      type: "updateStoryGroup",
      groupId: group.id,
      before: captureStoryGroupPatch(before, group.id, patch),
      after: patch,
    });
  }

  return events;
}

export function captureAssetGroupPatch(
  project: Project,
  groupId: string,
  patch: AssetGroupPatch
): AssetGroupPatch {
  const group = getAssetGroup(project, groupId);
  const before: AssetGroupPatch = {};
  for (const key of Object.keys(patch) as Array<keyof AssetGroupPatch>) {
    if (patch[key] === undefined) continue;
    before[key] = clone(group[key]) as never;
  }
  return before;
}

export function captureRemoveAssetGroupPayload(
  project: Project,
  groupId: string
): import("./types").RemoveAssetGroupPayload {
  const group = getAssetGroup(project, groupId);
  const groups = getAssetGroupsForType(project, group.assetType);
  const descendantIds = collectDescendantAssetGroupIds(groups, groupId);
  const removedGroupIds = new Set([groupId, ...descendantIds]);
  const removedGroups = getAssetGroups(project)
    .filter((entry) => removedGroupIds.has(entry.id))
    .map(clone);
  const assetAssignments = project.assets
    .filter((asset) => asset.groupId && removedGroupIds.has(asset.groupId))
    .map((asset) => ({ assetId: asset.id, groupId: asset.groupId }));

  return {
    rootGroupId: groupId,
    groups: removedGroups,
    assetAssignments,
  };
}

function captureAssetPatch(project: Project, assetId: string, patch: AssetPatch): AssetPatch {
  const asset = project.assets.find((entry) => entry.id === assetId);
  if (!asset) {
    throw new Error(`Asset "${assetId}" not found`);
  }
  const before: AssetPatch = {};
  for (const key of Object.keys(patch) as Array<keyof AssetPatch>) {
    if (patch[key] === undefined && key !== "groupId") continue;
    if (key === "groupId") {
      before.groupId = asset.groupId;
      continue;
    }
    if (key === "attributes") {
      before.attributes = capturePatchValue(asset.attributes) as never;
      continue;
    }
    before[key] = capturePatchValue(asset[key as keyof Asset]) as never;
  }
  return before;
}

export function buildAssetTreeMoveEvents(before: Project, after: Project): AppEvent[] {
  const events: AppEvent[] = [];

  for (const asset of after.assets) {
    const prev = before.assets.find((entry) => entry.id === asset.id);
    if (!prev) continue;
    const patch: AssetPatch = {};
    if (prev.groupId !== asset.groupId) patch.groupId = asset.groupId;
    if (prev.sortOrder !== asset.sortOrder) patch.sortOrder = asset.sortOrder;
    if (Object.keys(patch).length === 0) continue;
    events.push({
      ...createEventMeta(),
      type: "updateAsset",
      assetId: asset.id,
      before: captureAssetPatch(before, asset.id, patch),
      after: patch,
    });
  }

  for (const group of getAssetGroups(after)) {
    const prev = getAssetGroups(before).find((entry) => entry.id === group.id);
    if (!prev) continue;
    const patch: AssetGroupPatch = {};
    if (prev.parentGroupId !== group.parentGroupId) patch.parentGroupId = group.parentGroupId;
    if (prev.sortOrder !== group.sortOrder) patch.sortOrder = group.sortOrder;
    if (Object.keys(patch).length === 0) continue;
    events.push({
      ...createEventMeta(),
      type: "updateAssetGroup",
      groupId: group.id,
      before: captureAssetGroupPatch(before, group.id, patch),
      after: patch,
    });
  }

  for (const asset of after.assets) {
    if (asset.type !== "actor") continue;
    const prev = before.assets.find((entry) => entry.id === asset.id);
    if (!prev?.expressions) continue;
    for (const expression of asset.expressions ?? []) {
      const prevExpression = prev.expressions?.find((entry) => entry.id === expression.id);
      if (!prevExpression) continue;
      if (prevExpression.sortOrder === expression.sortOrder) continue;
      events.push({
        ...createEventMeta(),
        type: "updateActorExpression",
        actorId: asset.id,
        expressionId: expression.id,
        before: { sortOrder: prevExpression.sortOrder },
        after: { sortOrder: expression.sortOrder },
      });
    }
  }

  return events;
}

export function captureRemoveNodePayload(
  state: AppState,
  storyId: string,
  nodeId: string
): RemoveNodePayload {
  const story = getStory(state.project, storyId);
  const node = story.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Node "${nodeId}" not found`);
  }
  const nodePromptsByLocale: Record<string, NodePromptValue> = {};
  for (const locale of state.project.locales.map((entry) => entry.locale)) {
    const textTemplate = getNodeTextTemplate(state.promptsByLocale[locale], storyId, nodeId);
    const speaker = getNodeSpeaker(state.promptsByLocale[locale], storyId, nodeId);
    if (textTemplate || speaker) {
      nodePromptsByLocale[locale] = { textTemplate, speaker };
    }
  }
  return {
    node: clone(node),
    edges: story.edges
      .filter((edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId)
      .map(clone),
    entryNodeId: story.entryNodeId,
    nodePromptsByLocale,
  };
}

export function captureRemoveEdgePayload(
  state: AppState,
  storyId: string,
  edgeId: string
): RemoveEdgePayload {
  const story = getStory(state.project, storyId);
  const edge = story.edges.find((entry) => entry.id === edgeId);
  if (!edge) {
    throw new Error(`Edge "${edgeId}" not found`);
  }
  const edgePromptsByLocale: Record<string, EdgePromptValue> = {};
  for (const locale of state.project.locales.map((entry) => entry.locale)) {
    const optionText = state.promptsByLocale[locale]?.stories[storyId]?.edges[edgeId]?.optionText;
    if (optionText) {
      edgePromptsByLocale[locale] = { optionText };
    }
  }
  return {
    edge: clone(edge),
    edgePromptsByLocale,
  };
}

export function captureRemoveStoryPayload(
  state: AppState,
  storyId: string
): RemoveStoryPayload {
  const story = getStory(state.project, storyId);
  const storyPromptsByLocale: RemoveStoryPayload["storyPromptsByLocale"] = {};
  for (const locale of state.project.locales.map((entry) => entry.locale)) {
    const storyPrompts = state.promptsByLocale[locale]?.stories[storyId];
    if (storyPrompts) {
      storyPromptsByLocale[locale] = clone(storyPrompts);
    }
  }
  return {
    story: clone(story),
    storyPromptsByLocale,
  };
}

export function captureNodePromptsByLocale(
  promptsByLocale: PromptsByLocale,
  locales: string[],
  storyId: string,
  nodeId: string
): Record<string, NodePromptValue> {
  const result: Record<string, NodePromptValue> = {};
  for (const locale of locales) {
    const textTemplate = getNodeTextTemplate(promptsByLocale[locale], storyId, nodeId);
    const speaker = getNodeSpeaker(promptsByLocale[locale], storyId, nodeId);
    if (textTemplate || speaker) {
      result[locale] = { textTemplate, speaker };
    }
  }
  return result;
}

export function buildNavigationAfterSwitchStory(
  _state: AppState,
  storyId: string
): ReturnType<typeof getNavigationSnapshot> {
  return {
    activeStoryId: storyId,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedAssetId: null,
    selectedModuleId: null,
    selectedStoryId: storyId,
    highlightedRootNodeIds: [],
  };
}

export function buildNavigationAfterAddStory(state: AppState, storyId: string) {
  return buildNavigationAfterSwitchStory(state, storyId);
}

export function buildSelectionAfterSelectAsset(assetId: string | null) {
  return {
    selectedNodeIds: [] as string[],
    selectedEdgeIds: [] as string[],
    selectedAssetId: assetId,
    selectedModuleId: null as string | null,
    selectedStoryId: null as string | null,
  };
}

export function buildSelectionAfterSelectModule(moduleId: string | null) {
  return {
    selectedNodeIds: [] as string[],
    selectedEdgeIds: [] as string[],
    selectedAssetId: null as string | null,
    selectedModuleId: moduleId,
    selectedStoryId: null as string | null,
  };
}

export function buildSelectionAfterSelectStory(storyId: string | null) {
  return {
    selectedNodeIds: [] as string[],
    selectedEdgeIds: [] as string[],
    selectedAssetId: null as string | null,
    selectedModuleId: null as string | null,
    selectedStoryId: storyId,
  };
}

export function buildSelectionAfterGraphSelection(nodeIds: string[], edgeIds: string[]) {
  return {
    selectedNodeIds: nodeIds,
    selectedEdgeIds: edgeIds,
    selectedAssetId: null as string | null,
    selectedModuleId: null as string | null,
    selectedStoryId: null as string | null,
  };
}

export function buildEmptySelection() {
  return buildSelectionAfterSelectAsset(null);
}

export { createEventMeta, getNavigationSnapshot, getSelectionSnapshot };
