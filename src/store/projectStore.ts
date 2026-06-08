import { create } from "zustand";
import type { Project } from "@/core/model/types";
import {
  createEmptyProject,
  createStarterProject,
  parseProject,
  serializeProject,
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
import { hydrateLegacyEmbeddedAssets, hydrateProjectAssets } from "@/core/assets/assetHydration";
import {
  gcUnusedAssetBlobs,
  putAssetBlob,
  revokeWebAssetObjectUrl,
} from "@/core/assets/webAssetStorage";
import { ensureDefaultBackdrop, canRemoveAsset, canReplaceAsset } from "@/core/assets/defaultBackdrop";
import { parseAspectRatio } from "@/core/view/thumbnailAspectRatio";
import { packProjectArchive, unpackProjectArchive } from "@/core/project/projectArchive";
import { setProjectArchiveBaseDir } from "@/core/project/projectRuntimeContext";
import { isElectron } from "@/utils/isElectron";
import {
  beginHistoryTransaction as beginHistoryTransactionState,
  canRedoHistory,
  canUndoHistory,
  cancelHistoryTransaction as cancelHistoryTransactionState,
  clearHistory,
  cloneProject,
  collectAssetIdsFromHistory,
  collectAssetIdsFromProject,
  commitHistoryTransaction as commitHistoryTransactionState,
  createHistoryState,
  flushHistoryCoalesce,
  pushHistoryFromSnapshot,
  recordHistorySnapshot,
  redoHistory,
  shouldRecordHistory,
  undoHistory,
  type HistoryState,
} from "@/core/history/projectHistory";

const STORAGE_KEY = "muselab-project";
const PERSIST_DEBOUNCE_MS = 400;

export type MutationOptions = {
  record?: boolean;
  mergeKey?: string;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingHistory = false;

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

const LEGACY_THUMBNAIL_ASPECT_RATIO_STORAGE_KEY = "muselab-thumbnail-aspect-ratio";

function sanitizeLoadedProject(project: Project): Project {
  for (const asset of project.assets) {
    if (asset.url?.startsWith("blob:")) {
      delete asset.url;
    }
  }
  ensureDefaultBackdrop(project);
  normalizeEdgeTargetPorts(project);
  if (!project.thumbnailAspectRatio) {
    try {
      const raw = localStorage.getItem(LEGACY_THUMBNAIL_ASPECT_RATIO_STORAGE_KEY);
      if (raw) {
        const parsed = parseAspectRatio(JSON.parse(raw));
        if (parsed) project.thumbnailAspectRatio = parsed;
      }
    } catch {
      // ignore
    }
  }
  return project;
}

async function saveToStorageNow(project: Project): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(project));
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

function collectRetainedAssetIds(history: HistoryState, project: Project): Set<string> {
  const ids = collectAssetIdsFromProject(project);
  for (const id of collectAssetIdsFromHistory(history)) {
    ids.add(id);
  }
  return ids;
}

function scheduleAssetBlobGc(history: HistoryState, project: Project): void {
  if (isElectron()) return;
  const keepIds = collectRetainedAssetIds(history, project);
  void gcUnusedAssetBlobs(keepIds);
}

function clampSelectionForProject(
  project: Project,
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
  selectedAssetId: string | null
): {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
} {
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const edgeIds = new Set(project.edges.map((edge) => edge.id));
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  return {
    selectedNodeIds: selectedNodeIds.filter((id) => nodeIds.has(id)),
    selectedEdgeIds: selectedEdgeIds.filter((id) => edgeIds.has(id)),
    selectedAssetId: selectedAssetId && assetIds.has(selectedAssetId) ? selectedAssetId : null,
  };
}

function historyFlags(history: HistoryState): { canUndo: boolean; canRedo: boolean } {
  return {
    canUndo: canUndoHistory(history),
    canRedo: canRedoHistory(history),
  };
}

interface ProjectState {
  project: Project;
  lastSavedJson: string | null;
  projectArchiveBaseDir: string | null;
  loadedMlvnPath: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
  highlightedRootNodeIds: string[];
  history: HistoryState;
  canUndo: boolean;
  canRedo: boolean;
  setProject: (project: Project) => void;
  updateProject: (
    patch: Partial<
      Pick<
        Project,
        "name" | "entryNodeId" | "globalState" | "thumbnailAspectRatio" | "playerResolution"
      >
    >,
    options?: MutationOptions
  ) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  setSelectedAssetId: (assetId: string | null) => void;
  clearSelection: () => void;
  setHighlightedRootNodeIds: (ids: string[]) => void;
  clearPlayValidationHighlight: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
  newProject: (name?: string) => void;
  loadFromJson: (json: string) => Promise<void>;
  loadFromArchive: (data: Uint8Array, mlvnPath?: string | null) => Promise<void>;
  hydrateAssets: () => Promise<void>;
  exportArchive: () => Promise<Uint8Array>;
  isDirty: () => boolean;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  flushHistoryCoalesce: () => void;
  beginHistoryTransaction: () => void;
  commitHistoryTransaction: () => void;
  cancelHistoryTransaction: () => void;

  addNode: (position?: { x: number; y: number }) => StoryNode;
  cloneNode: (nodeId: string, position: { x: number; y: number }) => StoryNode | null;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateNode: (
    nodeId: string,
    patch: Partial<Omit<StoryNode, "id">>,
    options?: MutationOptions
  ) => void;

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
    patch: Partial<Pick<StoryEdge, "optionText" | "condition" | "vertices" | "manualRoute">>,
    options?: MutationOptions
  ) => void;

  addAsset: (
    type: Asset["type"],
    name: string,
    options?: { path?: string; url?: string; file?: File }
  ) => Promise<Asset>;
  updateAsset: (assetId: string, patch: Partial<Pick<Asset, "name">>, options?: MutationOptions) => void;
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
const initialHistory = createHistoryState();

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

function mutateProject(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  recipe: (project: Project) => void,
  options?: MutationOptions
): Project {
  const state = get();
  let history = state.history;

  if (!isApplyingHistory && shouldRecordHistory(history, options)) {
    history = recordHistorySnapshot(history, state.project, options?.mergeKey);
  }

  const project = cloneProject(state.project);
  recipe(project);
  set({
    project,
    history,
    ...historyFlags(history),
  });
  scheduleSaveToStorage(project);
  maybeClearPlayHighlight(project, get, set);
  scheduleAssetBlobGc(history, project);
  return project;
}

function applyHistoryRestore(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  project: Project,
  history: HistoryState
): void {
  isApplyingHistory = true;
  try {
    const state = get();
    const selection = clampSelectionForProject(
      project,
      state.selectedNodeIds,
      state.selectedEdgeIds,
      state.selectedAssetId
    );
    set({
      project: cloneProject(project),
      history,
      ...historyFlags(history),
      ...selection,
    });
    scheduleSaveToStorage(get().project);
    maybeClearPlayHighlight(project, get, set);
    scheduleAssetBlobGc(history, project);
  } finally {
    isApplyingHistory = false;
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initialState.project,
  lastSavedJson: initialState.lastSavedJson,
  projectArchiveBaseDir: null,
  loadedMlvnPath: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedAssetId: null,
  highlightedRootNodeIds: [],
  history: initialHistory,
  canUndo: false,
  canRedo: false,

  setProject: (project) => {
    const history = clearHistory(get().history);
    set({ project, history, ...historyFlags(history) });
    scheduleSaveToStorage(project);
    maybeClearPlayHighlight(project, get, set);
    scheduleAssetBlobGc(history, project);
  },

  updateProject: (patch, options) => {
    mutateProject(get, set, (project) => updateProjectInProject(project, patch), options);
  },

  setSelection: (nodeIds, edgeIds) =>
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds, selectedAssetId: null }),
  setSelectedAssetId: (assetId) =>
    set({ selectedAssetId: assetId, selectedNodeIds: [], selectedEdgeIds: [] }),
  clearSelection: () =>
    set({ selectedNodeIds: [], selectedEdgeIds: [], selectedAssetId: null }),
  setHighlightedRootNodeIds: (ids) => set({ highlightedRootNodeIds: ids }),
  clearPlayValidationHighlight: () => set({ highlightedRootNodeIds: [] }),

  flushHistoryCoalesce: () => {
    const history = flushHistoryCoalesce(get().history);
    if (history === get().history) return;
    set({ history, ...historyFlags(history) });
  },

  beginHistoryTransaction: () => {
    const history = beginHistoryTransactionState(get().history, get().project);
    set({ history });
  },

  commitHistoryTransaction: () => {
    const { history, shouldRecord, snapshot } = commitHistoryTransactionState(get().history);
    let nextHistory = history;
    if (shouldRecord && snapshot) {
      nextHistory = pushHistoryFromSnapshot(history, snapshot);
    }
    set({ history: nextHistory, ...historyFlags(nextHistory) });
  },

  cancelHistoryTransaction: () => {
    const history = cancelHistoryTransactionState(get().history);
    set({ history });
  },

  undo: () => {
    const state = get();
    const { history, project } = undoHistory(state.history, state.project);
    if (!project) return;
    applyHistoryRestore(get, set, project, history);
  },

  redo: () => {
    const state = get();
    const { history, project } = redoHistory(state.history, state.project);
    if (!project) return;
    applyHistoryRestore(get, set, project, history);
  },

  loadFromStorage: () => {
    const { project, lastSavedJson } = getInitialState();
    const history = clearHistory(get().history);
    set({ project, lastSavedJson, history, ...historyFlags(history) });
  },

  saveToStorage: () => {
    void saveToStorageNow(get().project);
  },

  newProject: (name) => {
    const project = createStarterProject(name);
    const json = serializeProject(project);
    const history = clearHistory(get().history);
    setProjectArchiveBaseDir(null);
    set({
      project,
      lastSavedJson: json,
      projectArchiveBaseDir: null,
      loadedMlvnPath: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      history,
      ...historyFlags(history),
    });
    void saveToStorageNow(project);
    scheduleAssetBlobGc(history, project);
  },

  hydrateAssets: async () => {
    isApplyingHistory = true;
    try {
      const project = cloneProject(get().project);
      await hydrateLegacyEmbeddedAssets(project);
      set({ project });
      scheduleSaveToStorage(project);
    } finally {
      isApplyingHistory = false;
    }
  },

  loadFromJson: async (json) => {
    const project = sanitizeLoadedProject(parseProject(json));
    await hydrateLegacyEmbeddedAssets(project);
    const snapshot = serializeProject(project);
    const history = clearHistory(get().history);
    setProjectArchiveBaseDir(null);
    set({
      project,
      lastSavedJson: snapshot,
      projectArchiveBaseDir: null,
      loadedMlvnPath: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      history,
      ...historyFlags(history),
    });
    scheduleSaveToStorage(project);
    scheduleAssetBlobGc(history, project);
  },

  loadFromArchive: async (data, mlvnPath = null) => {
    const { manifest, files } = unpackProjectArchive(data);
    const project = sanitizeLoadedProject(parseProject(manifest));
    const baseDir = await hydrateProjectAssets(project, { files, mlvnPath });
    const snapshot = serializeProject(project);
    const history = clearHistory(get().history);
    setProjectArchiveBaseDir(baseDir);
    set({
      project,
      lastSavedJson: snapshot,
      projectArchiveBaseDir: baseDir,
      loadedMlvnPath: mlvnPath ?? null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      history,
      ...historyFlags(history),
    });
    scheduleSaveToStorage(project);
    scheduleAssetBlobGc(history, project);
  },

  exportArchive: async () => packProjectArchive(get().project),

  isDirty: () => serializeProject(get().project) !== get().lastSavedJson,

  markSaved: () => {
    set({ lastSavedJson: serializeProject(get().project) });
  },

  addNode: (position) => {
    let node!: StoryNode;
    mutateProject(get, set, (project) => {
      node = addNodeInProject(project, position);
    });
    return node;
  },

  cloneNode: (nodeId, position) => {
    let node: StoryNode | null = null;
    mutateProject(get, set, (project) => {
      node = cloneNodeInProject(project, nodeId, position);
    });
    return node;
  },

  removeNode: (nodeId) => {
    mutateProject(get, set, (project) => removeNodeInProject(project, nodeId));
  },

  updateNodePosition: (nodeId, position) => {
    mutateProject(get, set, (project) => updateNodePositionInProject(project, nodeId, position));
  },

  updateNode: (nodeId, patch, options) => {
    mutateProject(get, set, (project) => updateNodeInProject(project, nodeId, patch), options);
  },

  addEdge: (sourceNodeId, targetNodeId, options) => {
    let edge!: StoryEdge;
    mutateProject(get, set, (project) => {
      edge = addEdgeInProject(project, sourceNodeId, targetNodeId, options);
    });
    return edge;
  },

  removeEdge: (edgeId) => {
    mutateProject(get, set, (project) => removeEdgeInProject(project, edgeId));
  },

  updateEdge: (edgeId, patch, options) => {
    mutateProject(get, set, (project) => updateEdgeInProject(project, edgeId, patch), options);
  },

  addAsset: async (type, name, options = {}) => {
    let asset!: Asset;
    mutateProject(get, set, (project) => {
      asset = addAssetInProject(project, type, name, {
        path: options.path,
        url: options.file ? undefined : options.url,
      });
    });
    if (options.file && !isElectron()) {
      await putAssetBlob(asset.id, options.file);
    }
    return asset;
  },

  updateAsset: (assetId, patch, options) => {
    mutateProject(get, set, (project) => updateAssetInProject(project, assetId, patch), options);
  },

  replaceAssetMedia: async (assetId, options) => {
    if (!canReplaceAsset(assetId)) return;
    mutateProject(get, set, (project) => {
      const usesBlob = Boolean(!isElectron() && options.file);
      replaceAssetMediaInProject(project, assetId, {
        path: options.path,
        blobStored: usesBlob,
      });
    });
    if (!isElectron() && options.file) {
      revokeWebAssetObjectUrl(assetId);
      await putAssetBlob(assetId, options.file);
    }
  },

  removeAsset: async (assetId) => {
    if (!canRemoveAsset(assetId)) return;
    mutateProject(get, set, (project) => removeAssetInProject(project, assetId));
    const selectedAssetId = get().selectedAssetId === assetId ? null : get().selectedAssetId;
    if (selectedAssetId !== get().selectedAssetId) {
      set({ selectedAssetId });
    }
  },

  getEntryNodeId: () => getEntryNodeId(get().project),
}));
