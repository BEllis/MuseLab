import type { Project, StoryNode } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
import { getNodeSpeaker, getNodeTextTemplate } from "@/core/locale/prompts";
import { getStory } from "@/core/model/project";
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

export function captureProjectPatch(
  project: Project,
  patch: ProjectPatch
): ProjectPatch {
  const before: ProjectPatch = {};
  for (const key of Object.keys(patch) as Array<keyof ProjectPatch>) {
    before[key] = clone(project[key]) as never;
  }
  return before;
}

export function captureNodePatch(
  project: Project,
  storyId: string,
  nodeId: string,
  patch: Partial<Omit<StoryNode, "id">>
): Partial<Omit<StoryNode, "id">> {
  const node = getStory(project, storyId).nodes.find((entry) => entry.id === nodeId);
  if (!node) return {};
  const before: Partial<Omit<StoryNode, "id">> = {};
  for (const key of Object.keys(patch) as Array<keyof Omit<StoryNode, "id">>) {
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
  patch: Partial<Pick<import("@/core/model/types").Story, "name" | "entryNodeId" | "globalState">>
): Partial<Pick<import("@/core/model/types").Story, "name" | "entryNodeId" | "globalState">> {
  const story = getStory(project, storyId);
  const before: Partial<Pick<import("@/core/model/types").Story, "name" | "entryNodeId" | "globalState">> =
    {};
  for (const key of Object.keys(patch) as Array<"name" | "entryNodeId" | "globalState">) {
    before[key] = clone(story[key]) as never;
  }
  return before;
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
  for (const locale of state.project.locales) {
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
  for (const locale of state.project.locales) {
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
  for (const locale of state.project.locales) {
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
    selectedServiceId: null,
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
    selectedServiceId: null as string | null,
  };
}

export function buildSelectionAfterSelectService(serviceId: string | null) {
  return {
    selectedNodeIds: [] as string[],
    selectedEdgeIds: [] as string[],
    selectedAssetId: null as string | null,
    selectedServiceId: serviceId,
  };
}

export function buildSelectionAfterGraphSelection(nodeIds: string[], edgeIds: string[]) {
  return {
    selectedNodeIds: nodeIds,
    selectedEdgeIds: edgeIds,
    selectedAssetId: null as string | null,
    selectedServiceId: null as string | null,
  };
}

export function buildEmptySelection() {
  return buildSelectionAfterSelectAsset(null);
}

export { createEventMeta, getNavigationSnapshot, getSelectionSnapshot };
