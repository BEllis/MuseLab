import { create } from "zustand";
import type { Project } from "@/core/model/types";
import {
  createEmptyProject,
  parseProject,
  serializeProject,
  addNode as addNodeInProject,
  removeNode as removeNodeInProject,
  updateNodePosition as updateNodePositionInProject,
  updateNode as updateNodeInProject,
  addEdge as addEdgeInProject,
  removeEdge as removeEdgeInProject,
  updateEdge as updateEdgeInProject,
  addAsset as addAssetInProject,
  updateAsset as updateAssetInProject,
  removeAsset as removeAssetInProject,
  getEntryNodeId,
} from "@/core/model/project";
import type { StoryNode, StoryEdge, Asset } from "@/core/model/types";

const STORAGE_KEY = "muselab-project";

function loadFromStorage(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseProject(raw);
  } catch {
    // ignore
  }
  return createEmptyProject();
}

function saveToStorage(project: Project): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(project));
  } catch {
    // ignore
  }
}

interface ProjectState {
  project: Project;
  lastSavedJson: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setProject: (project: Project) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
  newProject: (name?: string) => void;
  loadFromJson: (json: string) => void;
  exportJson: () => string;
  isDirty: () => boolean;
  markSaved: (json?: string) => void;

  addNode: (position?: { x: number; y: number }) => StoryNode;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, patch: Partial<Omit<StoryNode, "id">>) => void;

  addEdge: (
    sourceNodeId: string,
    targetNodeId: string,
    options?: { sourceHandle?: string; targetHandle?: string; optionText?: string; condition?: string }
  ) => StoryEdge;
  removeEdge: (edgeId: string) => void;
  updateEdge: (
    edgeId: string,
    patch: Partial<Pick<StoryEdge, "optionText" | "condition" | "sourceHandle" | "targetHandle">>
  ) => void;

  addAsset: (
    type: Asset["type"],
    name: string,
    options: { path?: string; url?: string }
  ) => Asset;
  updateAsset: (assetId: string, patch: Partial<Pick<Asset, "name">>) => void;
  removeAsset: (assetId: string) => void;

  getEntryNodeId: () => string | null;
}

function getInitialState(): { project: Project; lastSavedJson: string } {
  const project = loadFromStorage();
  return { project, lastSavedJson: serializeProject(project) };
}

const initialState = getInitialState();

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initialState.project,
  lastSavedJson: initialState.lastSavedJson,
  selectedNodeId: null,
  selectedEdgeId: null,

  setProject: (project) => {
    set({ project });
    saveToStorage(project);
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),

  loadFromStorage: () => {
    const { project, lastSavedJson } = getInitialState();
    set({ project, lastSavedJson });
  },

  saveToStorage: () => saveToStorage(get().project),

  newProject: (name) => {
    const project = createEmptyProject(name);
    const json = serializeProject(project);
    set({ project, lastSavedJson: json, selectedNodeId: null, selectedEdgeId: null });
    saveToStorage(project);
  },

  loadFromJson: (json) => {
    const project = parseProject(json);
    set({ project, lastSavedJson: json, selectedNodeId: null, selectedEdgeId: null });
    saveToStorage(project);
  },

  exportJson: () => serializeProject(get().project),

  isDirty: () => serializeProject(get().project) !== get().lastSavedJson,

  markSaved: (json) => {
    const snapshot = json ?? serializeProject(get().project);
    set({ lastSavedJson: snapshot });
  },

  addNode: (position) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const node = addNodeInProject(project, position);
    set({ project });
    saveToStorage(project);
    return node;
  },

  removeNode: (nodeId) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    removeNodeInProject(project, nodeId);
    set({ project });
    saveToStorage(project);
  },

  updateNodePosition: (nodeId, position) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateNodePositionInProject(project, nodeId, position);
    set({ project });
    saveToStorage(project);
  },

  updateNode: (nodeId, patch) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateNodeInProject(project, nodeId, patch);
    set({ project });
    saveToStorage(project);
  },

  addEdge: (sourceNodeId, targetNodeId, options) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const edge = addEdgeInProject(project, sourceNodeId, targetNodeId, options);
    set({ project });
    saveToStorage(project);
    return edge;
  },

  removeEdge: (edgeId) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    removeEdgeInProject(project, edgeId);
    set({ project });
    saveToStorage(project);
  },

  updateEdge: (edgeId, patch) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateEdgeInProject(project, edgeId, patch);
    set({ project });
    saveToStorage(project);
  },

  addAsset: (type, name, options) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const asset = addAssetInProject(project, type, name, options);
    set({ project });
    saveToStorage(project);
    return asset;
  },

  updateAsset: (assetId, patch) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateAssetInProject(project, assetId, patch);
    set({ project });
    saveToStorage(project);
  },

  removeAsset: (assetId) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    removeAssetInProject(project, assetId);
    set({ project });
    saveToStorage(project);
  },

  getEntryNodeId: () => getEntryNodeId(get().project),
}));
