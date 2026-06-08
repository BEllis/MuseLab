import { create } from "zustand";
import type { Project, Story } from "@/core/model/types";
import {
  createEmptyProject,
  createStarterProject,
  parseProject,
  addNode as addNodeInProject,
  type AddNodeOptions,
  cloneNode as cloneNodeInProject,
  removeNode as removeNodeInProject,
  updateNodePosition as updateNodePositionInProject,
  updateNode as updateNodeInProject,
  addEdge as addEdgeInProject,
  removeEdge as removeEdgeInProject,
  updateEdge as updateEdgeInProject,
  addAsset as addAssetInProject,
  addBlankActor as addBlankActorInProject,
  addActorFromImage as addActorFromImageInProject,
  addActorExpression as addActorExpressionInProject,
  updateActorExpression as updateActorExpressionInProject,
  replaceActorExpressionMedia as replaceActorExpressionMediaInProject,
  removeActorExpression as removeActorExpressionInProject,
  updateAsset as updateAssetInProject,
  replaceAssetMedia as replaceAssetMediaInProject,
  updateProject as updateProjectInProject,
  removeAsset as removeAssetInProject,
  getEntryNodeId,
  normalizeEdgeTargetPorts,
  addLocaleToProject,
  removeLocaleFromProject,
  addStory as addStoryInProject,
  removeStory as removeStoryInProject,
  updateStory as updateStoryInProject,
  getStory,
  getFirstStoryId,
} from "@/core/model/project";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import type { StoryNode, StoryEdge, Asset, StoryNodeType, ActorExpression } from "@/core/model/types";
import { expressionBlobKey } from "@/core/assets/actorExpressions";
import { hydrateLegacyEmbeddedAssets, hydrateProjectAssets } from "@/core/assets/assetHydration";
import {
  gcUnusedAssetBlobs,
  putAssetBlob,
  revokeWebAssetObjectUrl,
  deleteAssetBlob,
} from "@/core/assets/webAssetStorage";
import { ensureDefaultBackdrop, canRemoveAsset, canReplaceAsset } from "@/core/assets/defaultBackdrop";
import { parseAspectRatio } from "@/core/view/thumbnailAspectRatio";
import {
  assertArchivePromptLocales,
  packProjectArchive,
  unpackProjectArchive,
} from "@/core/project/projectArchive";
import { setProjectArchiveBaseDir } from "@/core/project/projectRuntimeContext";
import { fileToStoredBlob } from "@/core/assets/fileBlob";
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
  ensureStoryPromptsForAllLocales,
  removeEdgeFromAllLocales,
  removeLocaleFromPrompts,
  removeNodeFromAllLocales,
  removeStoryFromAllLocales,
  setEdgeOptionText,
  setNodeSpeaker,
  setNodeTextTemplate,
  type PromptsByLocale,
} from "@/core/locale/prompts";
import { assertValidLocaleTag } from "@/core/locale/localeTag";
import {
  validateStoredProjectJson,
  validateUnpackedArchive,
} from "@/core/project/loadValidation";

const STORAGE_KEY = "muselab-project";
const PERSIST_DEBOUNCE_MS = 400;

export type MutationOptions = {
  record?: boolean;
  mergeKey?: string;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingHistory = false;

function loadBundleFromStorage(): {
  bundle: ReturnType<typeof migrateProjectBundle>;
  loadWarnings: string[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loadWarnings = validateStoredProjectJson(raw);
      const bundle = sanitizeLoadedBundle(parseStoredProjectPayload(raw));
      if (serializeStoredProjectPayload(bundle) !== raw) {
        void saveToStorageNow(bundle);
      }
      return { bundle, loadWarnings };
    }
  } catch {
    // ignore
  }
  const project = createEmptyProject();
  return { bundle: migrateProjectBundle(project), loadWarnings: [] };
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
  activeStoryId: string,
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
  selectedAssetId: string | null
): {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
} {
  const story = project.stories.find((entry) => entry.id === activeStoryId);
  if (!story) {
    return { selectedNodeIds: [], selectedEdgeIds: [], selectedAssetId: null };
  }
  const nodeIds = new Set(story.nodes.map((node) => node.id));
  const edgeIds = new Set(story.edges.map((edge) => edge.id));
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  return {
    selectedNodeIds: selectedNodeIds.filter((id) => nodeIds.has(id)),
    selectedEdgeIds: selectedEdgeIds.filter((id) => edgeIds.has(id)),
    selectedAssetId: selectedAssetId && assetIds.has(selectedAssetId) ? selectedAssetId : null,
  };
}

export function selectActiveStory(project: Project, activeStoryId: string | null): Story {
  if (activeStoryId) {
    const story = project.stories.find((entry) => entry.id === activeStoryId);
    if (story) return story;
  }
  return getStory(project, getFirstStoryId(project));
}

function resolveActiveStoryId(project: Project, activeStoryId: string | null): string {
  if (activeStoryId && project.stories.some((story) => story.id === activeStoryId)) {
    return activeStoryId;
  }
  return getFirstStoryId(project);
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
  activeStoryId: string;
  lastSavedSnapshot: string | null;
  projectArchiveBaseDir: string | null;
  loadedMlvnPath: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
  highlightedRootNodeIds: string[];
  loadWarnings: string[];
  /** Bumped on undo/redo so the graph canvas can force a full resync. */
  graphRevision: number;
  history: HistoryState;
  canUndo: boolean;
  canRedo: boolean;
  setProject: (project: Project) => void;
  updateProject: (
    patch: Partial<
      Pick<Project, "name" | "thumbnailAspectRatio" | "playerResolution" | "locales">
    >,
    options?: MutationOptions
  ) => void;
  setActiveStoryId: (storyId: string) => void;
  addStory: (name?: string) => Story;
  removeStory: (storyId: string) => void;
  updateStory: (
    storyId: string,
    patch: Partial<Pick<Story, "name" | "entryNodeId" | "globalState">>,
    options?: MutationOptions
  ) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  setSelectedAssetId: (assetId: string | null) => void;
  clearSelection: () => void;
  setHighlightedRootNodeIds: (ids: string[]) => void;
  clearPlayValidationHighlight: () => void;
  dismissLoadWarnings: () => void;
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

  addNode: (
    position?: { x: number; y: number },
    options?: AddNodeOptions
  ) => StoryNode;
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
  updateNodeSpeaker: (
    locale: string,
    nodeId: string,
    speaker: string,
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
  addBlankActor: (name?: string) => Asset;
  addActorFromImage: (name: string, options?: { path?: string; file?: File }) => Promise<Asset>;
  addActorExpression: (actorId: string, name: string) => ActorExpression;
  updateActorExpression: (
    actorId: string,
    expressionId: string,
    patch: Partial<Pick<ActorExpression, "name">>,
    options?: MutationOptions
  ) => void;
  replaceActorExpressionMedia: (
    actorId: string,
    expressionId: string,
    options: { file?: File; path?: string }
  ) => Promise<void>;
  removeActorExpression: (actorId: string, expressionId: string) => void;
  updateAsset: (
    assetId: string,
    patch: Partial<
      Pick<Asset, "name" | "personality" | "appearance" | "backstory" | "notes" | "expressions">
    >,
    options?: MutationOptions
  ) => void;
  replaceAssetMedia: (
    assetId: string,
    options: { file?: File; path?: string }
  ) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;

  getEntryNodeId: () => string | null;
}

function getInitialState(): {
  bundle: ReturnType<typeof migrateProjectBundle>;
  lastSavedSnapshot: string;
  activeStoryId: string;
  loadWarnings: string[];
} {
  const { bundle, loadWarnings } = loadBundleFromStorage();
  return {
    bundle,
    lastSavedSnapshot: serializeProjectBundleSnapshot(bundle),
    activeStoryId: getFirstStoryId(bundle.project),
    loadWarnings,
  };
}

const initialState = getInitialState();
const initialHistory = createHistoryState();

function maybeClearPlayHighlight(
  project: Project,
  activeStoryId: string,
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void
): void {
  if (get().highlightedRootNodeIds.length === 0) return;
  const story = selectActiveStory(project, activeStoryId);
  if (validatePlayEntry(story).ok) {
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
  maybeClearPlayHighlight(bundle.project, get().activeStoryId, get, set);
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
      resolveActiveStoryId(bundle.project, state.activeStoryId),
      state.selectedNodeIds,
      state.selectedEdgeIds,
      state.selectedAssetId
    );
    const restored = cloneProjectBundle(bundle);
    const activeStoryId = resolveActiveStoryId(restored.project, state.activeStoryId);
    set({
      project: restored.project,
      promptsByLocale: restored.promptsByLocale,
      activeStoryId,
      graphRevision: state.graphRevision + 1,
      history,
      ...historyFlags(history),
      ...selection,
    });
    scheduleSaveToStorage(restored);
    maybeClearPlayHighlight(restored.project, activeStoryId, get, set);
    scheduleAssetBlobGc(history, restored.project);
  } finally {
    isApplyingHistory = false;
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initialState.bundle.project,
  promptsByLocale: initialState.bundle.promptsByLocale,
  activeStoryId: initialState.activeStoryId,
  lastSavedSnapshot: initialState.lastSavedSnapshot,
  projectArchiveBaseDir: null,
  loadedMlvnPath: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedAssetId: null,
  highlightedRootNodeIds: [],
  loadWarnings: initialState.loadWarnings,
  graphRevision: 0,
  history: initialHistory,
  canUndo: false,
  canRedo: false,

  setProject: (project) => {
    const bundle = migrateProjectBundle(project, get().promptsByLocale);
    const history = clearHistory(get().history);
    const activeStoryId = resolveActiveStoryId(bundle.project, get().activeStoryId);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      activeStoryId,
      history,
      ...historyFlags(history),
    });
    scheduleSaveToStorage(bundle);
    maybeClearPlayHighlight(bundle.project, activeStoryId, get, set);
    scheduleAssetBlobGc(history, bundle.project);
  },

  updateProject: (patch, options) => {
    mutateBundle(get, set, (bundle) => updateProjectInProject(bundle.project, patch), options);
  },

  setActiveStoryId: (storyId) => {
    const project = get().project;
    if (!project.stories.some((story) => story.id === storyId)) return;
    if (get().activeStoryId === storyId) return;
    set({
      activeStoryId: storyId,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      graphRevision: get().graphRevision + 1,
    });
  },

  addStory: (name) => {
    let story!: Story;
    mutateBundle(get, set, (bundle) => {
      story = addStoryInProject(bundle.project, name);
      ensureStoryPromptsForAllLocales(bundle.promptsByLocale, bundle.project, story.id);
    });
    set({
      activeStoryId: story.id,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      graphRevision: get().graphRevision + 1,
    });
    return story;
  },

  removeStory: (storyId) => {
    const state = get();
    if (state.project.stories.length <= 1) {
      throw new Error("Cannot remove the last story");
    }
    mutateBundle(get, set, (bundle) => {
      removeStoryInProject(bundle.project, storyId);
      removeStoryFromAllLocales(bundle.promptsByLocale, storyId);
    });
    const nextActiveStoryId =
      state.activeStoryId === storyId
        ? getFirstStoryId(get().project)
        : state.activeStoryId;
    set({
      activeStoryId: nextActiveStoryId,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
    });
  },

  updateStory: (storyId, patch, options) => {
    mutateBundle(
      get,
      set,
      (bundle) => updateStoryInProject(bundle.project, storyId, patch),
      options
    );
  },

  setSelection: (nodeIds, edgeIds) =>
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds, selectedAssetId: null }),
  setSelectedAssetId: (assetId) =>
    set({ selectedAssetId: assetId, selectedNodeIds: [], selectedEdgeIds: [] }),
  clearSelection: () =>
    set({ selectedNodeIds: [], selectedEdgeIds: [], selectedAssetId: null }),
  setHighlightedRootNodeIds: (ids) => set({ highlightedRootNodeIds: ids }),
  clearPlayValidationHighlight: () => set({ highlightedRootNodeIds: [] }),

  dismissLoadWarnings: () => set({ loadWarnings: [] }),

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
    const { bundle, lastSavedSnapshot, activeStoryId } = getInitialState();
    const history = clearHistory(get().history);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      activeStoryId,
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
    const activeStoryId = getFirstStoryId(bundle.project);
    setProjectArchiveBaseDir(null);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      activeStoryId,
      lastSavedSnapshot: snapshot,
      projectArchiveBaseDir: null,
      loadedMlvnPath: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      loadWarnings: [],
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
    const loadWarnings = validateStoredProjectJson(json);
    const bundle = sanitizeLoadedBundle(parseStoredProjectPayload(json));
    await hydrateLegacyEmbeddedAssets(bundle.project);
    const snapshot = serializeProjectBundleSnapshot(bundle);
    const history = clearHistory(get().history);
    const activeStoryId = getFirstStoryId(bundle.project);
    setProjectArchiveBaseDir(null);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      activeStoryId,
      lastSavedSnapshot: snapshot,
      projectArchiveBaseDir: null,
      loadedMlvnPath: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      loadWarnings,
      history,
      ...historyFlags(history),
    });
    scheduleSaveToStorage(bundle);
    scheduleAssetBlobGc(history, bundle.project);
  },

  loadFromArchive: async (data, mlvnPath = null) => {
    const { manifest, files, prompts, metadata } = unpackProjectArchive(data);
    const loadWarnings = validateUnpackedArchive({ manifest, files, prompts, metadata });
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
    const activeStoryId = getFirstStoryId(bundle.project);
    setProjectArchiveBaseDir(baseDir);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      activeStoryId,
      lastSavedSnapshot: snapshot,
      projectArchiveBaseDir: baseDir,
      loadedMlvnPath: mlvnPath ?? null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedAssetId: null,
      highlightedRootNodeIds: [],
      loadWarnings,
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

  addNode: (position, options) => {
    const storyId = get().activeStoryId;
    const type: StoryNodeType = options?.type ?? "scene";
    let node!: StoryNode;
    mutateBundle(get, set, (bundle) => {
      node = addNodeInProject(bundle.project, storyId, position, type);
    });
    return node;
  },

  cloneNode: (nodeId, position) => {
    const storyId = get().activeStoryId;
    let node: StoryNode | null = null;
    mutateBundle(get, set, (bundle) => {
      node = cloneNodeInProject(bundle.project, storyId, nodeId, position);
      if (node) {
        cloneNodePrompts(bundle.promptsByLocale, storyId, nodeId, node.id);
      }
    });
    return node;
  },

  removeNode: (nodeId) => {
    const storyId = get().activeStoryId;
    mutateBundle(get, set, (bundle) => {
      removeNodeInProject(bundle.project, storyId, nodeId);
      removeNodeFromAllLocales(bundle.promptsByLocale, storyId, nodeId);
    });
  },

  updateNodePosition: (nodeId, position) => {
    const storyId = get().activeStoryId;
    mutateBundle(get, set, (bundle) =>
      updateNodePositionInProject(bundle.project, storyId, nodeId, position)
    );
  },

  updateNode: (nodeId, patch, options) => {
    const storyId = get().activeStoryId;
    mutateBundle(
      get,
      set,
      (bundle) => updateNodeInProject(bundle.project, storyId, nodeId, patch),
      options
    );
  },

  updateNodePrompt: (locale, nodeId, textTemplate, options) => {
    const storyId = get().activeStoryId;
    const tag = assertValidLocaleTag(locale);
    mutateBundle(get, set, (bundle) => {
      const prompts = ensureLocalePrompts(bundle.promptsByLocale, tag);
      setNodeTextTemplate(prompts, storyId, nodeId, textTemplate);
    }, options);
  },

  updateNodeSpeaker: (locale, nodeId, speaker, options) => {
    const storyId = get().activeStoryId;
    const tag = assertValidLocaleTag(locale);
    mutateBundle(get, set, (bundle) => {
      const prompts = ensureLocalePrompts(bundle.promptsByLocale, tag);
      setNodeSpeaker(prompts, storyId, nodeId, speaker);
    }, options);
  },

  updateEdgePrompt: (locale, edgeId, optionText, options) => {
    const storyId = get().activeStoryId;
    const tag = assertValidLocaleTag(locale);
    mutateBundle(get, set, (bundle) => {
      const prompts = ensureLocalePrompts(bundle.promptsByLocale, tag);
      setEdgeOptionText(prompts, storyId, edgeId, optionText);
    }, options);
  },

  addLocale: (locale) => {
    mutateBundle(get, set, (bundle) => {
      addLocaleToProject(bundle.project, locale);
      const tag = assertValidLocaleTag(locale);
      const localePrompts = createEmptyLocalePrompts();
      for (const story of bundle.project.stories) {
        localePrompts.stories[story.id] = { nodes: {}, edges: {} };
      }
      bundle.promptsByLocale[tag] = localePrompts;
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
    const storyId = get().activeStoryId;
    let edge!: StoryEdge;
    mutateBundle(get, set, (bundle) => {
      edge = addEdgeInProject(bundle.project, storyId, sourceNodeId, targetNodeId, options);
    });
    return edge;
  },

  removeEdge: (edgeId) => {
    const storyId = get().activeStoryId;
    mutateBundle(get, set, (bundle) => {
      removeEdgeInProject(bundle.project, storyId, edgeId);
      removeEdgeFromAllLocales(bundle.promptsByLocale, storyId, edgeId);
    });
  },

  updateEdge: (edgeId, patch, options) => {
    const storyId = get().activeStoryId;
    mutateBundle(
      get,
      set,
      (bundle) => updateEdgeInProject(bundle.project, storyId, edgeId, patch),
      options
    );
  },

  addAsset: async (type, name, options = {}) => {
    if (type === "actor") {
      if (options.file || options.path) {
        return get().addActorFromImage(name, { file: options.file, path: options.path });
      }
      return get().addBlankActor(name);
    }

    let asset!: Asset;
    const storesBlob = Boolean(options.file && !isElectron());
    mutateBundle(get, set, (bundle) => {
      asset = addAssetInProject(bundle.project, type, name, {
        path: options.path,
        url: options.file ? undefined : options.url,
      });
      if (storesBlob) {
        replaceAssetMediaInProject(bundle.project, asset.id, { blobStored: true });
      }
    });
    if (options.file && !isElectron()) {
      await putAssetBlob(asset.id, await fileToStoredBlob(options.file));
    }
    return asset;
  },

  addBlankActor: (name = "New actor") => {
    let asset!: Asset;
    mutateBundle(get, set, (bundle) => {
      asset = addBlankActorInProject(bundle.project, name);
    });
    return asset;
  },

  addActorFromImage: async (name, options = {}) => {
    let asset!: Asset;
    const storesBlob = Boolean(options.file && !isElectron());
    mutateBundle(get, set, (bundle) => {
      asset = addActorFromImageInProject(bundle.project, name, {
        path: options.path,
        blobStored: storesBlob,
      });
    });
    if (options.file && !isElectron()) {
      const expressionId = asset.expressions?.[0]?.id;
      if (expressionId) {
        await putAssetBlob(
          expressionBlobKey(asset.id, expressionId),
          await fileToStoredBlob(options.file)
        );
      }
    }
    return asset;
  },

  addActorExpression: (actorId, name) => {
    let expression!: ActorExpression;
    mutateBundle(get, set, (bundle) => {
      expression = addActorExpressionInProject(bundle.project, actorId, name);
    });
    return expression;
  },

  updateActorExpression: (actorId, expressionId, patch, options) => {
    mutateBundle(
      get,
      set,
      (bundle) => updateActorExpressionInProject(bundle.project, actorId, expressionId, patch),
      options
    );
  },

  replaceActorExpressionMedia: async (actorId, expressionId, options) => {
    const blobKey = expressionBlobKey(actorId, expressionId);
    mutateBundle(get, set, (bundle) => {
      replaceActorExpressionMediaInProject(bundle.project, actorId, expressionId, {
        path: options.path,
        blobStored: Boolean(!isElectron() && options.file),
      });
    });
    if (!isElectron() && options.file) {
      revokeWebAssetObjectUrl(blobKey);
      await putAssetBlob(blobKey, await fileToStoredBlob(options.file));
    }
  },

  removeActorExpression: (actorId, expressionId) => {
    mutateBundle(get, set, (bundle) => {
      removeActorExpressionInProject(bundle.project, actorId, expressionId);
    });
    void deleteAssetBlob(expressionBlobKey(actorId, expressionId));
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
      await putAssetBlob(assetId, await fileToStoredBlob(options.file));
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

  getEntryNodeId: () => getEntryNodeId(get().project, get().activeStoryId),
}));

export type { PromptsByLocale };
