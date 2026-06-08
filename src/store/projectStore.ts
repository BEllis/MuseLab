import { create } from "zustand";
import type { Project } from "@/core/model/types";
import {
  createEmptyProject,
  createStarterProject,
  parseProject,
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
  addLocaleToProject,
  removeLocaleFromProject,
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
import {
  assertArchivePromptLocales,
  packProjectArchive,
  unpackProjectArchive,
} from "@/core/project/projectArchive";
import { setProjectArchiveBaseDir } from "@/core/project/projectRuntimeContext";
import { isElectron } from "@/utils/isElectron";
import {
  beginHistoryTransaction as beginHistoryTransactionState,
  canRedoHistory,
  canUndoHistory,
  cancelHistoryTransaction as cancelHistoryTransactionState,
  clearHistory,
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
import {
  cloneProjectBundle,
  migrateProjectBundle,
  parseStoredProjectPayload,
  serializeProjectBundleSnapshot,
  serializeStoredProjectPayload,
} from "@/core/model/projectBundle";
import {
  cloneNodePrompts,
  createEmptyLocalePrompts,
  ensureLocalePrompts,
  ensurePromptsForProjectLocales,
  removeEdgeFromAllLocales,
  removeLocaleFromPrompts,
  removeNodeFromAllLocales,
  setEdgeOptionText,
  setNodeTextTemplate,
  type PromptsByLocale,
} from "@/core/locale/prompts";
import { assertValidLocaleTag } from "@/core/locale/localeTag";

const STORAGE_KEY = "muselab-project";
const PERSIST_DEBOUNCE_MS = 400;

export type MutationOptions = {
  record?: boolean;
  mergeKey?: string;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingHistory = false;

function loadBundleFromStorage(): ReturnType<typeof migrateProjectBundle> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const bundle = sanitizeLoadedBundle(parseStoredProjectPayload(raw));
      if (serializeStoredProjectPayload(bundle) !== raw) {
        void saveToStorageNow(bundle);
      }
      return bundle;
    }
  } catch {
    // ignore
  }
  const project = createEmptyProject();
  return migrateProjectBundle(project);
}

const LEGACY_THUMBNAIL_ASPECT_RATIO_STORAGE_KEY = "muselab-thumbnail-aspect-ratio";

function sanitizeLoadedBundle(bundle: ReturnType<typeof migrateProjectBundle>) {
  for (const asset of bundle.project.assets) {
    if (asset.url?.startsWith("blob:")) {
      delete asset.url;
    }
  }
  ensureDefaultBackdrop(bundle.project);
  normalizeEdgeTargetPorts(bundle.project);
  if (!bundle.project.thumbnailAspectRatio) {
    try {
      const raw = localStorage.getItem(LEGACY_THUMBNAIL_ASPECT_RATIO_STORAGE_KEY);
      if (raw) {
        const parsed = parseAspectRatio(JSON.parse(raw));
        if (parsed) bundle.project.thumbnailAspectRatio = parsed;
      }
    } catch {
      // ignore
    }
  }
  bundle.promptsByLocale = ensurePromptsForProjectLocales(
    bundle.project,
    bundle.promptsByLocale
  );
  return bundle;
}

async function saveToStorageNow(bundle: ReturnType<typeof migrateProjectBundle>): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, serializeStoredProjectPayload(bundle));
  } catch {
    // ignore
  }
}

function scheduleSaveToStorage(bundle: ReturnType<typeof migrateProjectBundle>): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void saveToStorageNow(bundle);
  }, PERSIST_DEBOUNCE_MS);
}

function getBundle(state: Pick<ProjectState, "project" | "promptsByLocale">) {
  return { project: state.project, promptsByLocale: state.promptsByLocale };
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
  promptsByLocale: PromptsByLocale;
  lastSavedSnapshot: string | null;
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
        "name" | "entryNodeId" | "globalState" | "thumbnailAspectRatio" | "playerResolution" | "locales"
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
  updateNodePrompt: (
    locale: string,
    nodeId: string,
    textTemplate: string,
    options?: MutationOptions
  ) => void;
  updateEdgePrompt: (
    locale: string,
    edgeId: string,
    optionText: string | undefined,
    options?: MutationOptions
  ) => void;
  addLocale: (locale: string) => void;
  removeLocale: (locale: string) => void;

  addEdge: (
    sourceNodeId: string,
    targetNodeId: string,
    options?: {
      id?: string;
      condition?: string;
      sourcePortId?: string | null;
      targetPortId?: string | null;
    }
  ) => StoryEdge;
  removeEdge: (edgeId: string) => void;
  updateEdge: (
    edgeId: string,
    patch: Partial<Pick<StoryEdge, "condition" | "vertices" | "manualRoute">>,
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

function getInitialState(): { bundle: ReturnType<typeof migrateProjectBundle>; lastSavedSnapshot: string } {
  const bundle = loadBundleFromStorage();
  return { bundle, lastSavedSnapshot: serializeProjectBundleSnapshot(bundle) };
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

function mutateBundle(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  recipe: (bundle: ReturnType<typeof migrateProjectBundle>) => void,
  options?: MutationOptions
): ReturnType<typeof migrateProjectBundle> {
  const state = get();
  let history = state.history;
  const beforeBundle = getBundle(state);

  if (!isApplyingHistory && shouldRecordHistory(history, options)) {
    history = recordHistorySnapshot(history, beforeBundle, options?.mergeKey);
  }

  const bundle = cloneProjectBundle(beforeBundle);
  recipe(bundle);
  bundle.promptsByLocale = ensurePromptsForProjectLocales(bundle.project, bundle.promptsByLocale);
  set({
    project: bundle.project,
    promptsByLocale: bundle.promptsByLocale,
    history,
    ...historyFlags(history),
  });
  scheduleSaveToStorage(bundle);
  maybeClearPlayHighlight(bundle.project, get, set);
  scheduleAssetBlobGc(history, bundle.project);
  return bundle;
}

function applyHistoryRestore(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  bundle: ReturnType<typeof migrateProjectBundle>,
  history: HistoryState
): void {
  isApplyingHistory = true;
  try {
    const state = get();
    const selection = clampSelectionForProject(
      bundle.project,
      state.selectedNodeIds,
      state.selectedEdgeIds,
      state.selectedAssetId
    );
    const restored = cloneProjectBundle(bundle);
    set({
      project: restored.project,
      promptsByLocale: restored.promptsByLocale,
      history,
      ...historyFlags(history),
      ...selection,
    });
    scheduleSaveToStorage(restored);
    maybeClearPlayHighlight(restored.project, get, set);
    scheduleAssetBlobGc(history, restored.project);
  } finally {
    isApplyingHistory = false;
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initialState.bundle.project,
  promptsByLocale: initialState.bundle.promptsByLocale,
  lastSavedSnapshot: initialState.lastSavedSnapshot,
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
    const bundle = migrateProjectBundle(project, get().promptsByLocale);
    const history = clearHistory(get().history);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      history,
      ...historyFlags(history),
    });
    scheduleSaveToStorage(bundle);
    maybeClearPlayHighlight(bundle.project, get, set);
    scheduleAssetBlobGc(history, bundle.project);
  },

  updateProject: (patch, options) => {
    mutateBundle(get, set, (bundle) => updateProjectInProject(bundle.project, patch), options);
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
    const history = beginHistoryTransactionState(get().history, getBundle(get()));
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
    const { history, bundle } = undoHistory(state.history, getBundle(state));
    if (!bundle) return;
    applyHistoryRestore(get, set, bundle, history);
  },

  redo: () => {
    const state = get();
    const { history, bundle } = redoHistory(state.history, getBundle(state));
    if (!bundle) return;
    applyHistoryRestore(get, set, bundle, history);
  },

  loadFromStorage: () => {
    const { bundle, lastSavedSnapshot } = getInitialState();
    const history = clearHistory(get().history);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      lastSavedSnapshot,
      history,
      ...historyFlags(history),
    });
  },

  saveToStorage: () => {
    void saveToStorageNow(getBundle(get()));
  },

  newProject: (name) => {
    const project = createStarterProject(name);
    const bundle = migrateProjectBundle(project);
    const snapshot = serializeProjectBundleSnapshot(bundle);
    const history = clearHistory(get().history);
    setProjectArchiveBaseDir(null);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      lastSavedSnapshot: snapshot,
      projectArchiveBaseDir: null,
      loadedMlvnPath: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      history,
      ...historyFlags(history),
    });
    void saveToStorageNow(bundle);
    scheduleAssetBlobGc(history, bundle.project);
  },

  hydrateAssets: async () => {
    isApplyingHistory = true;
    try {
      const bundle = cloneProjectBundle(getBundle(get()));
      await hydrateLegacyEmbeddedAssets(bundle.project);
      set({ project: bundle.project, promptsByLocale: bundle.promptsByLocale });
      scheduleSaveToStorage(bundle);
    } finally {
      isApplyingHistory = false;
    }
  },

  loadFromJson: async (json) => {
    const project = parseProject(json);
    const bundle = sanitizeLoadedBundle(migrateProjectBundle(project));
    await hydrateLegacyEmbeddedAssets(bundle.project);
    const snapshot = serializeProjectBundleSnapshot(bundle);
    const history = clearHistory(get().history);
    setProjectArchiveBaseDir(null);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      lastSavedSnapshot: snapshot,
      projectArchiveBaseDir: null,
      loadedMlvnPath: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      history,
      ...historyFlags(history),
    });
    scheduleSaveToStorage(bundle);
    scheduleAssetBlobGc(history, bundle.project);
  },

  loadFromArchive: async (data, mlvnPath = null) => {
    const { manifest, files, prompts } = unpackProjectArchive(data);
    const project = parseProject(manifest);
    assertArchivePromptLocales(project.locales, prompts);
    const promptsByLocale: PromptsByLocale = {};
    for (const [locale, localePrompts] of prompts.entries()) {
      promptsByLocale[locale] = localePrompts;
    }
    const bundle = sanitizeLoadedBundle(migrateProjectBundle(project, promptsByLocale));
    const baseDir = await hydrateProjectAssets(bundle.project, { files, mlvnPath });
    const snapshot = serializeProjectBundleSnapshot(bundle);
    const history = clearHistory(get().history);
    setProjectArchiveBaseDir(baseDir);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      lastSavedSnapshot: snapshot,
      projectArchiveBaseDir: baseDir,
      loadedMlvnPath: mlvnPath ?? null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      history,
      ...historyFlags(history),
    });
    scheduleSaveToStorage(bundle);
    scheduleAssetBlobGc(history, bundle.project);
  },

  exportArchive: async () => packProjectArchive(getBundle(get())),

  isDirty: () => serializeProjectBundleSnapshot(getBundle(get())) !== get().lastSavedSnapshot,

  markSaved: () => {
    set({ lastSavedSnapshot: serializeProjectBundleSnapshot(getBundle(get())) });
  },

  addNode: (position) => {
    let node!: StoryNode;
    mutateBundle(get, set, (bundle) => {
      node = addNodeInProject(bundle.project, position);
    });
    return node;
  },

  cloneNode: (nodeId, position) => {
    let node: StoryNode | null = null;
    mutateBundle(get, set, (bundle) => {
      node = cloneNodeInProject(bundle.project, nodeId, position);
      if (node) {
        cloneNodePrompts(bundle.promptsByLocale, nodeId, node.id);
      }
    });
    return node;
  },

  removeNode: (nodeId) => {
    mutateBundle(get, set, (bundle) => {
      removeNodeInProject(bundle.project, nodeId);
      removeNodeFromAllLocales(bundle.promptsByLocale, nodeId);
    });
  },

  updateNodePosition: (nodeId, position) => {
    mutateBundle(get, set, (bundle) => updateNodePositionInProject(bundle.project, nodeId, position));
  },

  updateNode: (nodeId, patch, options) => {
    mutateBundle(get, set, (bundle) => updateNodeInProject(bundle.project, nodeId, patch), options);
  },

  updateNodePrompt: (locale, nodeId, textTemplate, options) => {
    const tag = assertValidLocaleTag(locale);
    mutateBundle(get, set, (bundle) => {
      const prompts = ensureLocalePrompts(bundle.promptsByLocale, tag);
      setNodeTextTemplate(prompts, nodeId, textTemplate);
    }, options);
  },

  updateEdgePrompt: (locale, edgeId, optionText, options) => {
    const tag = assertValidLocaleTag(locale);
    mutateBundle(get, set, (bundle) => {
      const prompts = ensureLocalePrompts(bundle.promptsByLocale, tag);
      setEdgeOptionText(prompts, edgeId, optionText);
    }, options);
  },

  addLocale: (locale) => {
    mutateBundle(get, set, (bundle) => {
      addLocaleToProject(bundle.project, locale);
      const tag = assertValidLocaleTag(locale);
      bundle.promptsByLocale[tag] = createEmptyLocalePrompts();
    });
  },

  removeLocale: (locale) => {
    const tag = assertValidLocaleTag(locale);
    mutateBundle(get, set, (bundle) => {
      removeLocaleFromProject(bundle.project, tag);
      bundle.promptsByLocale = removeLocaleFromPrompts(bundle.promptsByLocale, tag);
    });
  },

  addEdge: (sourceNodeId, targetNodeId, options) => {
    let edge!: StoryEdge;
    mutateBundle(get, set, (bundle) => {
      edge = addEdgeInProject(bundle.project, sourceNodeId, targetNodeId, options);
    });
    return edge;
  },

  removeEdge: (edgeId) => {
    mutateBundle(get, set, (bundle) => {
      removeEdgeInProject(bundle.project, edgeId);
      removeEdgeFromAllLocales(bundle.promptsByLocale, edgeId);
    });
  },

  updateEdge: (edgeId, patch, options) => {
    mutateBundle(get, set, (bundle) => updateEdgeInProject(bundle.project, edgeId, patch), options);
  },

  addAsset: async (type, name, options = {}) => {
    let asset!: Asset;
    mutateBundle(get, set, (bundle) => {
      asset = addAssetInProject(bundle.project, type, name, {
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
    mutateBundle(get, set, (bundle) => updateAssetInProject(bundle.project, assetId, patch), options);
  },

  replaceAssetMedia: async (assetId, options) => {
    if (!canReplaceAsset(assetId)) return;
    mutateBundle(get, set, (bundle) => {
      const usesBlob = Boolean(!isElectron() && options.file);
      replaceAssetMediaInProject(bundle.project, assetId, {
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
    mutateBundle(get, set, (bundle) => removeAssetInProject(bundle.project, assetId));
    const selectedAssetId = get().selectedAssetId === assetId ? null : get().selectedAssetId;
    if (selectedAssetId !== get().selectedAssetId) {
      set({ selectedAssetId });
    }
  },

  getEntryNodeId: () => getEntryNodeId(get().project),
}));

export type { PromptsByLocale };
