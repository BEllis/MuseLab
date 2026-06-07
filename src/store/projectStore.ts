import { create } from "zustand";
import type { Project } from "@/core/model/types";
import {
  createEmptyProject,
  createStarterProject,
  parseProject,
  serializeProject,
  serializeProjectForSave,
  addNode as addNodeInProject,
  cloneNode as cloneNodeInProject,
  removeNode as removeNodeInProject,
  updateNodePosition as updateNodePositionInProject,
  updateNode as updateNodeInProject,
  addEdge as addEdgeInProject,
  removeEdge as removeEdgeInProject,
  updateEdge as updateEdgeInProject,
  addAsset as addAssetInProject,
  updateAsset as updateAssetInProject,
  replaceAssetMedia as replaceAssetMediaInProject,
  updateProject as updateProjectInProject,
  removeAsset as removeAssetInProject,
  getEntryNodeId,
  normalizeEdgeTargetPorts,
} from "@/core/model/project";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import type { StoryNode, StoryEdge, Asset } from "@/core/model/types";
import { hydrateActorImages } from "@/core/assets/actorImageSerialization";
import { deleteAssetBlob, putAssetBlob, revokeWebAssetObjectUrl } from "@/core/assets/webAssetStorage";
import { ensureDefaultBackdrop, canRemoveAsset, canReplaceAsset } from "@/core/assets/defaultBackdrop";
import { isElectron } from "@/utils/isElectron";

const STORAGE_KEY = "muselab-project";
const PERSIST_DEBOUNCE_MS = 400;

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function loadFromStorage(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const project = sanitizeLoadedProject(parseProject(raw));
      if (serializeProject(project) !== raw) {
        void saveToStorageNow(project);
      }
      return project;
    }
  } catch {
    // ignore
  }
  return createEmptyProject();
}

function sanitizeLoadedProject(project: Project): Project {
  for (const asset of project.assets) {
    if (asset.url?.startsWith("blob:")) {
      delete asset.url;
    }
  }
  ensureDefaultBackdrop(project);
  normalizeEdgeTargetPorts(project);
  return project;
}

async function saveToStorageNow(project: Project): Promise<void> {
  try {
    const json = await serializeProjectForSave(project);
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // ignore
  }
}

function scheduleSaveToStorage(project: Project): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void saveToStorageNow(project);
  }, PERSIST_DEBOUNCE_MS);
}

interface ProjectState {
  project: Project;
  lastSavedJson: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
  highlightedRootNodeIds: string[];
  setProject: (project: Project) => void;
  updateProject: (patch: Partial<Pick<Project, "name" | "entryNodeId" | "globalState">>) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  setSelectedAssetId: (assetId: string | null) => void;
  clearSelection: () => void;
  setHighlightedRootNodeIds: (ids: string[]) => void;
  clearPlayValidationHighlight: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
  newProject: (name?: string) => void;
  loadFromJson: (json: string) => Promise<void>;
  hydrateAssets: () => Promise<void>;
  exportJson: () => Promise<string>;
  isDirty: () => boolean;
  markSaved: (json?: string) => void;

  addNode: (position?: { x: number; y: number }) => StoryNode;
  cloneNode: (nodeId: string, position: { x: number; y: number }) => StoryNode | null;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, patch: Partial<Omit<StoryNode, "id">>) => void;

  addEdge: (
    sourceNodeId: string,
    targetNodeId: string,
    options?: {
      id?: string;
      optionText?: string;
      condition?: string;
      sourcePortId?: string | null;
      targetPortId?: string | null;
    }
  ) => StoryEdge;
  removeEdge: (edgeId: string) => void;
  updateEdge: (
    edgeId: string,
    patch: Partial<Pick<StoryEdge, "optionText" | "condition" | "vertices" | "manualRoute">>
  ) => void;

  addAsset: (
    type: Asset["type"],
    name: string,
    options?: { path?: string; url?: string; file?: File }
  ) => Promise<Asset>;
  updateAsset: (assetId: string, patch: Partial<Pick<Asset, "name">>) => void;
  replaceAssetMedia: (
    assetId: string,
    options: { file?: File; path?: string }
  ) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;

  getEntryNodeId: () => string | null;
}

function getInitialState(): { project: Project; lastSavedJson: string } {
  const project = loadFromStorage();
  return { project, lastSavedJson: serializeProject(project) };
}

const initialState = getInitialState();

function maybeClearPlayHighlight(
  project: Project,
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void
): void {
  if (get().highlightedRootNodeIds.length === 0) return;
  if (validatePlayEntry(project).ok) {
    set({ highlightedRootNodeIds: [] });
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initialState.project,
  lastSavedJson: initialState.lastSavedJson,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedAssetId: null,
  highlightedRootNodeIds: [],

  setProject: (project) => {
    set({ project });
    scheduleSaveToStorage(project);
    maybeClearPlayHighlight(project, get, set);
  },

  updateProject: (patch) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateProjectInProject(project, patch);
    set({ project });
    scheduleSaveToStorage(project);
  },

  setSelection: (nodeIds, edgeIds) =>
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds, selectedAssetId: null }),
  setSelectedAssetId: (assetId) =>
    set({ selectedAssetId: assetId, selectedNodeIds: [], selectedEdgeIds: [] }),
  clearSelection: () =>
    set({ selectedNodeIds: [], selectedEdgeIds: [], selectedAssetId: null }),
  setHighlightedRootNodeIds: (ids) => set({ highlightedRootNodeIds: ids }),
  clearPlayValidationHighlight: () => set({ highlightedRootNodeIds: [] }),

  loadFromStorage: () => {
    const { project, lastSavedJson } = getInitialState();
    set({ project, lastSavedJson });
  },

  saveToStorage: () => {
    void saveToStorageNow(get().project);
  },

  newProject: (name) => {
    const project = createStarterProject(name);
    const json = serializeProject(project);
    set({
      project,
      lastSavedJson: json,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
    });
    void saveToStorageNow(project);
  },

  hydrateAssets: async () => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    await hydrateActorImages(project);
    set({ project });
    scheduleSaveToStorage(project);
  },

  loadFromJson: async (json) => {
    const project = sanitizeLoadedProject(parseProject(json));
    await hydrateActorImages(project);
    set({
      project,
      lastSavedJson: json,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
    });
    scheduleSaveToStorage(project);
  },

  exportJson: async () => serializeProjectForSave(get().project),

  isDirty: () => serializeProject(get().project) !== get().lastSavedJson,

  markSaved: (json) => {
    const snapshot = json ?? serializeProject(get().project);
    set({ lastSavedJson: snapshot });
  },

  addNode: (position) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const node = addNodeInProject(project, position);
    set({ project });
    scheduleSaveToStorage(project);
    maybeClearPlayHighlight(project, get, set);
    return node;
  },

  cloneNode: (nodeId, position) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const node = cloneNodeInProject(project, nodeId, position);
    if (!node) return null;
    set({ project });
    scheduleSaveToStorage(project);
    maybeClearPlayHighlight(project, get, set);
    return node;
  },

  removeNode: (nodeId) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    removeNodeInProject(project, nodeId);
    set({ project });
    scheduleSaveToStorage(project);
    maybeClearPlayHighlight(project, get, set);
  },

  updateNodePosition: (nodeId, position) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateNodePositionInProject(project, nodeId, position);
    set({ project });
    scheduleSaveToStorage(project);
  },

  updateNode: (nodeId, patch) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateNodeInProject(project, nodeId, patch);
    set({ project });
    scheduleSaveToStorage(project);
  },

  addEdge: (sourceNodeId, targetNodeId, options) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const edge = addEdgeInProject(project, sourceNodeId, targetNodeId, options);
    set({ project });
    scheduleSaveToStorage(project);
    maybeClearPlayHighlight(project, get, set);
    return edge;
  },

  removeEdge: (edgeId) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    removeEdgeInProject(project, edgeId);
    set({ project });
    scheduleSaveToStorage(project);
    maybeClearPlayHighlight(project, get, set);
  },

  updateEdge: (edgeId, patch) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateEdgeInProject(project, edgeId, patch);
    set({ project });
    scheduleSaveToStorage(project);
  },

  addAsset: async (type, name, options = {}) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const asset = addAssetInProject(project, type, name, {
      path: options.path,
      url: options.file ? undefined : options.url,
    });
    if (options.file && !isElectron()) {
      await putAssetBlob(asset.id, options.file);
    }
    set({ project });
    scheduleSaveToStorage(project);
    return asset;
  },

  updateAsset: (assetId, patch) => {
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    updateAssetInProject(project, assetId, patch);
    set({ project });
    scheduleSaveToStorage(project);
  },

  replaceAssetMedia: async (assetId, options) => {
    if (!canReplaceAsset(assetId)) return;
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    const usesBlob = Boolean(!isElectron() && options.file);
    replaceAssetMediaInProject(project, assetId, {
      path: options.path,
      blobStored: usesBlob,
    });
    if (usesBlob && options.file) {
      revokeWebAssetObjectUrl(assetId);
      await putAssetBlob(assetId, options.file);
    }
    set({ project });
    scheduleSaveToStorage(project);
  },

  removeAsset: async (assetId) => {
    if (!canRemoveAsset(assetId)) return;
    const project = JSON.parse(JSON.stringify(get().project)) as Project;
    removeAssetInProject(project, assetId);
    if (!isElectron()) {
      await deleteAssetBlob(assetId);
    }
    const selectedAssetId = get().selectedAssetId === assetId ? null : get().selectedAssetId;
    set({ project, selectedAssetId });
    scheduleSaveToStorage(project);
  },

  getEntryNodeId: () => getEntryNodeId(get().project),
}));
