import type { Project } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";

export type AppState = {
  project: Project;
  promptsByLocale: PromptsByLocale;
  activeStoryId: string;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
  selectedServiceId: string | null;
  highlightedRootNodeIds: string[];
};

export type SelectionSnapshot = {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
  selectedServiceId: string | null;
};

export type NavigationSnapshot = SelectionSnapshot & {
  activeStoryId: string;
  highlightedRootNodeIds: string[];
};

export function cloneAppState(state: AppState): AppState {
  return {
    project: JSON.parse(JSON.stringify(state.project)) as Project,
    promptsByLocale: JSON.parse(JSON.stringify(state.promptsByLocale)) as PromptsByLocale,
    activeStoryId: state.activeStoryId,
    selectedNodeIds: [...state.selectedNodeIds],
    selectedEdgeIds: [...state.selectedEdgeIds],
    selectedAssetId: state.selectedAssetId,
    selectedServiceId: state.selectedServiceId,
    highlightedRootNodeIds: [...state.highlightedRootNodeIds],
  };
}

export function getSelectionSnapshot(state: AppState): SelectionSnapshot {
  return {
    selectedNodeIds: [...state.selectedNodeIds],
    selectedEdgeIds: [...state.selectedEdgeIds],
    selectedAssetId: state.selectedAssetId,
    selectedServiceId: state.selectedServiceId,
  };
}

export function getNavigationSnapshot(state: AppState): NavigationSnapshot {
  return {
    ...getSelectionSnapshot(state),
    activeStoryId: state.activeStoryId,
    highlightedRootNodeIds: [...state.highlightedRootNodeIds],
  };
}

export function applySelectionSnapshot(state: AppState, snapshot: SelectionSnapshot): void {
  state.selectedNodeIds = [...snapshot.selectedNodeIds];
  state.selectedEdgeIds = [...snapshot.selectedEdgeIds];
  state.selectedAssetId = snapshot.selectedAssetId;
  state.selectedServiceId = snapshot.selectedServiceId;
}

export function applyNavigationSnapshot(state: AppState, snapshot: NavigationSnapshot): void {
  applySelectionSnapshot(state, snapshot);
  state.activeStoryId = snapshot.activeStoryId;
  state.highlightedRootNodeIds = [...snapshot.highlightedRootNodeIds];
}

export function createEventMeta(): { id: string; timestamp: number } {
  return { id: crypto.randomUUID(), timestamp: Date.now() };
}
