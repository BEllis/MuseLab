import { create } from "zustand";
import type { Project, Story, StoryGroup, AssetGroup, AssetType } from "@/core/model/types";
import {
  createStarterProject,
  parseProject,
  addNode as addNodeInProject,
  type AddNodeOptions,
  cloneNode as cloneNodeInProject,
  addEdge as addEdgeInProject,
  addAsset as addAssetInProject,
  addBlankActor as addBlankActorInProject,
  addActorFromImage as addActorFromImageInProject,
  addActorExpression as addActorExpressionInProject,
  replaceAssetMedia as replaceAssetMediaInProject,
  getEntryNodeId,
  normalizeEdgeTargetPorts,
  addStory as addStoryInProject,
  addStoryGroup as addStoryGroupInProject,
  addAssetGroup as addAssetGroupInProject,
  addModule as addModuleInProject,
  getStory,
  getStoryGroup,
  getAssetGroup,
  getFirstStoryId,
} from "@/core/model/project";
import { validatePlayEntry } from "@/core/model/graphHierarchy";
import type {
  StoryNode,
  StoryEdge,
  Asset,
  StoryNodeType,
  ActorExpression,
  ModuleInterface,
  EndNodeLayout,
} from "@/core/model/types";
import { isSceneNode } from "@/core/model/nodeTypes";
import {
  placeStoryTreeItem as placeStoryTreeItemInProject,
  type StoryTreePlacement,
  type StoryTreeSibling,
} from "@/core/model/storyTree";
import {
  placeAssetTreeItem as placeAssetTreeItemInProject,
  type AssetTreePlacement,
  type AssetTreeSibling,
} from "@/core/model/assetTree";
import {
  defaultEndNodePosition,
  endNodeLayoutsEqual,
  getEndNodeLayout,
  mergeEndNodeLayout,
} from "@/core/model/endNodeLayout";
import { expressionBlobKey } from "@/core/assets/actorExpressions";
import { hydrateLegacyEmbeddedAssets, hydrateProjectAssets } from "@/core/assets/assetHydration";
import {
  gcUnusedAssetBlobs,
  putAssetBlob,
  remapAssetBlobKeys,
  revokeWebAssetObjectUrl,
  deleteAssetBlob,
} from "@/core/assets/webAssetStorage";
import { ensureDefaultBackdrop, canRemoveAsset, canReplaceAsset } from "@/core/assets/defaultBackdrop";
import {
  assertArchivePromptLocales,
  packProjectArchive,
  unpackProjectArchive,
} from "@/core/project/projectArchive";
import { setProjectArchiveBaseDir } from "@/core/project/projectRuntimeContext";
import { fileToStoredBlob } from "@/core/assets/fileBlob";
import { isElectron } from "@/utils/isElectron";
import { applyEvent } from "@/core/events/applyEvent";
import type { AppState } from "@/core/events/appState";
import {
  captureNodePatch,
  capturePatchValue,
  captureProjectPatch,
  captureRemoveEdgePayload,
  captureRemoveNodePayload,
  captureRemoveStoryPayload,
  captureRemoveStoryGroupPayload,
  captureRemoveAssetGroupPayload,
  captureStoryPatch,
  captureStoryGroupPatch,
  captureAssetGroupPatch,
  buildStoryTreeMoveEvents,
  buildAssetTreeMoveEvents,
  captureNodePromptsByLocale,
  buildEmptySelection,
  buildNavigationAfterAddStory,
  buildNavigationAfterSwitchStory,
  buildSelectionAfterGraphSelection,
  buildSelectionAfterSelectAsset,
  buildSelectionAfterSelectModule,
  createEventMeta,
  getNavigationSnapshot,
  getSelectionSnapshot,
} from "@/core/events/capture";
import {
  beginEventTransaction,
  canRedoEventLog,
  canUndoEventLog,
  cancelEventTransaction,
  clearEventLog,
  commitEventTransaction,
  flushEventLogCoalesce,
  getRedoEvent,
  getUndoEvent,
  recordEvent,
  shouldRecordEvent,
  stepEventLogCursor,
  type EventLogState,
} from "@/core/events/eventLog";
import {
  collectAssetIdsFromEventLog,
  collectAssetIdsFromProject,
} from "@/core/events/eventLogAssets";
import {
  emptyStoredSession,
  type StoredProjectSession,
} from "@/core/events/persistedSession";
import type { AppEvent } from "@/core/events/types";
import { eventTouchesActiveStory, eventNeedsFullGraphRefresh } from "@/core/events/types";
import {
  cloneProjectBundle,
  migrateProjectBundle,
  parseStoredProjectPayload,
  serializeProjectBundleSnapshot,
} from "@/core/model/projectBundle";
import {
  cloneNodePrompts,
  createEmptyLocalePrompts,
  ensurePromptsForProjectLocales,
  ensureStoryPromptsForAllLocales,
  getNodeSpeaker,
  getNodeTextTemplate,
  type PromptsByLocale,
} from "@/core/locale/prompts";
import { assertValidLocaleTag } from "@/core/locale/localeTag";
import {
  validateStoredProjectJson,
  validateUnpackedArchive,
} from "@/core/project/loadValidation";
import {
  loadAutosaveFromLocalStorage,
  loadAutosaveFromPersistence,
  readLegacyThumbnailAspectRatio,
  saveAutosaveToPersistence,
  serializeAutosavePayload,
  type LoadedAutosave,
} from "@/core/persistence/projectAutosave";

const PERSIST_DEBOUNCE_MS = 400;

export type MutationOptions = {
  record?: boolean;
  mergeKey?: string;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistGetState: (() => ProjectState) | null = null;
let isApplyingEvent = false;

export function isProjectHistoryReplayActive(): boolean {
  return isApplyingEvent;
}
let pendingBlobKeyRemappings: Array<{ from: string; to: string }> = [];

function sanitizeLoadedBundle(bundle: ReturnType<typeof migrateProjectBundle>) {
  for (const asset of bundle.project.assets) {
    if (asset.url?.startsWith("blob:")) {
      delete asset.url;
    }
  }
  ensureDefaultBackdrop(bundle.project);
  normalizeEdgeTargetPorts(bundle.project);
  readLegacyThumbnailAspectRatio(bundle.project);
  bundle.promptsByLocale = ensurePromptsForProjectLocales(
    bundle.project,
    bundle.promptsByLocale
  );
  return bundle;
}

function prepareLoadedAutosave(loaded: LoadedAutosave): {
  bundle: ReturnType<typeof migrateProjectBundle>;
  session: StoredProjectSession;
  loadWarnings: string[];
  lastSavedSnapshot: string;
} {
  const bundle = sanitizeLoadedBundle(loaded.bundle);
  pendingBlobKeyRemappings = bundle.blobKeyRemappings ?? [];
  bundle.blobKeyRemappings = [];
  const session = sanitizeLoadedSession(
    bundle.project,
    loaded.session ?? emptyStoredSession(getFirstStoryId(bundle.project))
  );
  const lastSavedSnapshot = serializeProjectBundleSnapshot(bundle);
  const normalizedPayload = serializeAutosavePayload({ bundle, session });
  if (normalizedPayload !== loaded.raw) {
    void saveAutosaveToPersistence({ bundle, session });
  }
  return { bundle, session, loadWarnings: loaded.loadWarnings, lastSavedSnapshot };
}

function createFallbackInitialState(): {
  bundle: ReturnType<typeof migrateProjectBundle>;
  session: StoredProjectSession;
  lastSavedSnapshot: string;
  loadWarnings: string[];
} {
  const project = createStarterProject();
  const bundle = migrateProjectBundle(project);
  const session = emptyStoredSession(getFirstStoryId(bundle.project));
  return {
    bundle,
    session,
    lastSavedSnapshot: serializeProjectBundleSnapshot(bundle),
    loadWarnings: [],
  };
}

function getModuleInitialState(): {
  bundle: ReturnType<typeof migrateProjectBundle>;
  session: StoredProjectSession;
  lastSavedSnapshot: string;
  loadWarnings: string[];
} {
  if (isElectron()) {
    return createFallbackInitialState();
  }
  const loaded = loadAutosaveFromLocalStorage();
  if (!loaded) return createFallbackInitialState();
  return prepareLoadedAutosave(loaded);
}

async function applyBlobKeyRemappings(
  bundle?: ReturnType<typeof migrateProjectBundle>
): Promise<void> {
  const remappings = [...pendingBlobKeyRemappings, ...(bundle?.blobKeyRemappings ?? [])];
  pendingBlobKeyRemappings = [];
  if (bundle) bundle.blobKeyRemappings = [];
  if (!remappings.length) return;
  if (!isElectron()) {
    await remapAssetBlobKeys(remappings);
  }
}

async function saveProjectStateToStorage(state: {
  bundle: ReturnType<typeof migrateProjectBundle>;
  session: StoredProjectSession;
}): Promise<void> {
  await saveAutosaveToPersistence(state);
}

function getBundle(state: Pick<ProjectState, "project" | "promptsByLocale">) {
  return { project: state.project, promptsByLocale: state.promptsByLocale };
}

function getStoredSessionFromState(state: ProjectState): StoredProjectSession {
  return {
    activeStoryId: state.activeStoryId,
    selectedNodeIds: state.selectedNodeIds,
    selectedEdgeIds: state.selectedEdgeIds,
    selectedAssetId: state.selectedAssetId,
    selectedModuleId: state.selectedModuleId,
    highlightedRootNodeIds: state.highlightedRootNodeIds,
    eventLog: state.eventLog,
  };
}

function sanitizeLoadedSession(
  project: Project,
  session: StoredProjectSession
): StoredProjectSession {
  const activeStoryId = resolveActiveStoryId(project, session.activeStoryId);
  const story = project.stories.find((entry) => entry.id === activeStoryId);
  const nodeIds = new Set(story?.nodes.map((node) => node.id) ?? []);
  const edgeIds = new Set(story?.edges.map((edge) => edge.id) ?? []);
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const moduleIds = new Set((project.modules ?? []).map((service) => service.id));

  return {
    activeStoryId,
    selectedNodeIds: session.selectedNodeIds.filter((id) => nodeIds.has(id)),
    selectedEdgeIds: session.selectedEdgeIds.filter((id) => edgeIds.has(id)),
    selectedAssetId:
      session.selectedAssetId && assetIds.has(session.selectedAssetId)
        ? session.selectedAssetId
        : null,
    selectedModuleId:
      session.selectedModuleId && moduleIds.has(session.selectedModuleId)
        ? session.selectedModuleId
        : null,
    highlightedRootNodeIds: session.highlightedRootNodeIds.filter((id) => nodeIds.has(id)),
    eventLog: session.eventLog,
  };
}

function scheduleSaveToStorage(get: () => ProjectState): void {
  persistGetState = get;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const state = persistGetState?.() ?? get();
    void saveProjectStateToStorage({
      bundle: getBundle(state),
      session: getStoredSessionFromState(state),
    });
  }, PERSIST_DEBOUNCE_MS);
}

function collectRetainedAssetIds(eventLog: EventLogState, project: Project): Set<string> {
  const ids = collectAssetIdsFromProject(project);
  for (const id of collectAssetIdsFromEventLog(eventLog)) {
    ids.add(id);
  }
  return ids;
}

function scheduleAssetBlobGc(eventLog: EventLogState, project: Project): void {
  if (isElectron()) return;
  const keepIds = collectRetainedAssetIds(eventLog, project);
  void gcUnusedAssetBlobs(keepIds);
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

function eventLogFlags(eventLog: EventLogState): { canUndo: boolean; canRedo: boolean } {
  return {
    canUndo: canUndoEventLog(eventLog),
    canRedo: canRedoEventLog(eventLog),
  };
}

function getAppState(state: Pick<
  ProjectState,
  | "project"
  | "promptsByLocale"
  | "activeStoryId"
  | "selectedNodeIds"
  | "selectedEdgeIds"
  | "selectedAssetId"
  | "selectedModuleId"
  | "highlightedRootNodeIds"
>): AppState {
  return {
    project: state.project,
    promptsByLocale: state.promptsByLocale,
    activeStoryId: state.activeStoryId,
    selectedNodeIds: state.selectedNodeIds,
    selectedEdgeIds: state.selectedEdgeIds,
    selectedAssetId: state.selectedAssetId,
    selectedModuleId: state.selectedModuleId,
    highlightedRootNodeIds: state.highlightedRootNodeIds,
  };
}

function applyAppStateToStore(
  after: AppState,
  eventLog: EventLogState,
  graphRevision?: number
): Partial<ProjectState> {
  return {
    project: after.project,
    promptsByLocale: after.promptsByLocale,
    activeStoryId: after.activeStoryId,
    selectedNodeIds: after.selectedNodeIds,
    selectedEdgeIds: after.selectedEdgeIds,
    selectedAssetId: after.selectedAssetId,
    selectedModuleId: after.selectedModuleId,
    highlightedRootNodeIds: after.highlightedRootNodeIds,
    eventLog,
    ...eventLogFlags(eventLog),
    ...(graphRevision !== undefined ? { graphRevision } : {}),
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
  selectedModuleId: string | null;
  highlightedRootNodeIds: string[];
  loadWarnings: string[];
  /** Bumped on undo/redo so the graph canvas can force a full resync. */
  graphRevision: number;
  eventLog: EventLogState;
  canUndo: boolean;
  canRedo: boolean;
  setProject: (project: Project) => void;
  updateProject: (
    patch: Partial<
      Pick<
        Project,
        | "name"
        | "thumbnailAspectRatio"
        | "playerResolution"
        | "locales"
        | "defaultLocale"
        | "promptRendererTypescriptSource"
      >
    >,
    options?: MutationOptions
  ) => void;
  setActiveStoryId: (storyId: string) => void;
  addStory: (name?: string, groupId?: string) => Story;
  removeStory: (storyId: string) => void;
  updateStory: (
    storyId: string,
    patch: Partial<Pick<Story, "name" | "entryNodeId" | "globalState" | "groupId">>,
    options?: MutationOptions
  ) => void;
  addStoryGroup: (name?: string, parentGroupId?: string) => StoryGroup;
  removeStoryGroup: (groupId: string) => void;
  updateStoryGroup: (
    groupId: string,
    patch: Partial<Pick<StoryGroup, "name" | "parentGroupId" | "sortOrder">>,
    options?: MutationOptions
  ) => void;
  placeStoryTreeItem: (item: StoryTreeSibling, placement: StoryTreePlacement) => void;
  addAssetGroup: (assetType: AssetType, name?: string, parentGroupId?: string) => AssetGroup;
  removeAssetGroup: (groupId: string) => void;
  updateAssetGroup: (
    groupId: string,
    patch: Partial<Pick<AssetGroup, "name" | "parentGroupId" | "sortOrder">>,
    options?: MutationOptions
  ) => void;
  placeAssetTreeItem: (item: AssetTreeSibling, placement: AssetTreePlacement) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  setSelectedAssetId: (assetId: string | null) => void;
  setSelectedModuleId: (moduleId: string | null) => void;
  addModule: (name?: string) => ModuleInterface;
  removeModule: (moduleId: string) => void;
  updateModule: (
    moduleId: string,
    patch: Partial<Pick<ModuleInterface, "name" | "bindingName" | "methods" | "typescriptSource">>,
    options?: MutationOptions
  ) => void;
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
  updateNodePositions: (
    updates: ReadonlyArray<{ nodeId: string; position: { x: number; y: number } }>
  ) => void;
  updateEndNodeLayout: (
    sceneId: string,
    patch: Partial<EndNodeLayout>,
    options?: MutationOptions
  ) => void;
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
      Pick<Asset, "name" | "personality" | "appearance" | "voiceAccent" | "backstory" | "notes" | "expressions" | "defaultExpressionId">
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
  session: StoredProjectSession;
  lastSavedSnapshot: string;
  loadWarnings: string[];
} {
  return getModuleInitialState();
}

const initialState = getInitialState();

function maybeClearPlayHighlight(
  project: Project,
  activeStoryId: string,
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void
): void {
  if (isApplyingEvent) return;
  if (get().highlightedRootNodeIds.length === 0) return;
  const story = selectActiveStory(project, activeStoryId);
  if (validatePlayEntry(story).ok) {
    set({ highlightedRootNodeIds: [] });
  }
}

function dispatchEvent(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  event: AppEvent,
  options?: MutationOptions
): AppState {
  return dispatchEventBatch(get, set, [event], options);
}

function dispatchEventBatch(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  events: AppEvent[],
  options?: MutationOptions
): AppState {
  if (isApplyingEvent || events.length === 0) {
    return getAppState(get());
  }

  const state = get();
  let after = getAppState(state);
  for (const event of events) {
    after = applyEvent(after, event, "forward");
  }

  const recordedEvent: AppEvent =
    events.length === 1
      ? events[0]
      : {
          ...createEventMeta(),
          type: "batch",
          events,
        };

  let eventLog = state.eventLog;
  if (shouldRecordEvent(eventLog, options)) {
    eventLog = recordEvent(eventLog, recordedEvent, { mergeKey: options?.mergeKey });
  }

  const graphRevision = events.some((event) => eventTouchesActiveStory(event))
    ? state.graphRevision + 1
    : undefined;
  set(applyAppStateToStore(after, eventLog, graphRevision));
  scheduleSaveToStorage(get);
  maybeClearPlayHighlight(after.project, after.activeStoryId, get, set);
  scheduleAssetBlobGc(eventLog, after.project);
  return after;
}

function applyEventStep(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  direction: "forward" | "backward"
): void {
  const state = get();
  const event =
    direction === "backward" ? getUndoEvent(state.eventLog) : getRedoEvent(state.eventLog);
  if (!event) return;

  isApplyingEvent = true;
  try {
    const before = getAppState(state);
    const after = applyEvent(before, event, direction === "backward" ? "backward" : "forward");
    const eventLog = stepEventLogCursor(state.eventLog, direction === "backward" ? -1 : 1);
    const graphRevision = eventNeedsFullGraphRefresh(event)
      ? state.graphRevision + 1
      : undefined;
    set(applyAppStateToStore(after, eventLog, graphRevision));
    scheduleSaveToStorage(get);
    maybeClearPlayHighlight(after.project, after.activeStoryId, get, set);
    scheduleAssetBlobGc(eventLog, after.project);
  } finally {
    queueMicrotask(() => {
      isApplyingEvent = false;
    });
  }
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSelectionSnapshot(
  left: ReturnType<typeof getSelectionSnapshot>,
  right: ReturnType<typeof getSelectionSnapshot>
): boolean {
  return (
    sameStringArray(left.selectedNodeIds, right.selectedNodeIds) &&
    sameStringArray(left.selectedEdgeIds, right.selectedEdgeIds) &&
    left.selectedAssetId === right.selectedAssetId &&
    left.selectedModuleId === right.selectedModuleId
  );
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initialState.bundle.project,
  promptsByLocale: initialState.bundle.promptsByLocale,
  activeStoryId: initialState.session.activeStoryId,
  lastSavedSnapshot: initialState.lastSavedSnapshot,
  projectArchiveBaseDir: null,
  loadedMlvnPath: null,
  selectedNodeIds: initialState.session.selectedNodeIds,
  selectedEdgeIds: initialState.session.selectedEdgeIds,
  selectedAssetId: initialState.session.selectedAssetId,
  selectedModuleId: initialState.session.selectedModuleId,
  highlightedRootNodeIds: initialState.session.highlightedRootNodeIds,
  loadWarnings: initialState.loadWarnings,
  graphRevision: 0,
  eventLog: initialState.session.eventLog,
  canUndo: canUndoEventLog(initialState.session.eventLog),
  canRedo: canRedoEventLog(initialState.session.eventLog),

  setProject: (project) => {
    const bundle = migrateProjectBundle(project, get().promptsByLocale);
    const eventLog = clearEventLog(get().eventLog);
    const activeStoryId = resolveActiveStoryId(bundle.project, get().activeStoryId);
    set({
      project: bundle.project,
      promptsByLocale: bundle.promptsByLocale,
      activeStoryId,
      eventLog,
      ...eventLogFlags(eventLog),
    });
    scheduleSaveToStorage(get);
    maybeClearPlayHighlight(bundle.project, activeStoryId, get, set);
    scheduleAssetBlobGc(eventLog, bundle.project);
  },

  updateProject: (patch, options) => {
    const state = get();
    const before = captureProjectPatch(state.project, patch);
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateProject",
        before,
        after: patch,
      },
      options
    );
  },

  setActiveStoryId: (storyId) => {
    const state = get();
    if (!state.project.stories.some((story) => story.id === storyId)) return;
    if (state.activeStoryId === storyId) return;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "setActiveStoryId",
      before: getNavigationSnapshot(getAppState(state)),
      after: buildNavigationAfterSwitchStory(getAppState(state), storyId),
    });
  },

  addStory: (name, groupId) => {
    const state = get();
    const bundle = cloneProjectBundle(getBundle(state));
    const story = addStoryInProject(bundle.project, name, groupId);
    ensureStoryPromptsForAllLocales(bundle.promptsByLocale, bundle.project, story.id);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addStory",
      before: getNavigationSnapshot(getAppState(state)),
      after: {
        story,
        navigation: buildNavigationAfterAddStory(getAppState(state), story.id),
      },
    });
    return story;
  },

  removeStory: (storyId) => {
    const state = get();
    if (state.project.stories.length <= 1) {
      throw new Error("Cannot remove the last story");
    }
    const payload = captureRemoveStoryPayload(getAppState(state), storyId);
    const nextActiveStoryId =
      state.activeStoryId === storyId ? getFirstStoryId(state.project) : state.activeStoryId;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeStory",
      before: {
        ...payload,
        navigation: getNavigationSnapshot(getAppState(state)),
      },
      after: {
        ...getNavigationSnapshot(getAppState(state)),
        activeStoryId: nextActiveStoryId,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedAssetId: null,
        selectedModuleId: state.selectedModuleId,
        highlightedRootNodeIds: [],
      },
    });
  },

  updateStory: (storyId, patch, options) => {
    const state = get();
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateStory",
        storyId,
        before: captureStoryPatch(state.project, storyId, patch),
        after: patch,
      },
      options
    );
  },

  addStoryGroup: (name, parentGroupId) => {
    const state = get();
    const bundle = cloneProjectBundle(getBundle(state));
    const group = addStoryGroupInProject(bundle.project, name, parentGroupId);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addStoryGroup",
      before: null,
      after: group,
    });
    return group;
  },

  removeStoryGroup: (groupId) => {
    const state = get();
    getStoryGroup(state.project, groupId);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeStoryGroup",
      before: captureRemoveStoryGroupPayload(state.project, groupId),
      after: null,
    });
  },

  updateStoryGroup: (groupId, patch, options) => {
    const state = get();
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateStoryGroup",
        groupId,
        before: captureStoryGroupPatch(state.project, groupId, patch),
        after: patch,
      },
      options
    );
  },

  placeStoryTreeItem: (item, placement) => {
    const state = get();
    const before = state.project;
    const bundle = cloneProjectBundle(getBundle(state));
    placeStoryTreeItemInProject(bundle.project, item, placement);
    const events = buildStoryTreeMoveEvents(before, bundle.project);
    if (events.length === 0) return;
    dispatchEventBatch(get, set, events, {
      mergeKey: `story-tree-move:${item.kind}:${item.id}`,
    });
  },

  addAssetGroup: (assetType, name, parentGroupId) => {
    const state = get();
    const bundle = cloneProjectBundle(getBundle(state));
    const group = addAssetGroupInProject(bundle.project, assetType, name, parentGroupId);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addAssetGroup",
      before: null,
      after: group,
    });
    return group;
  },

  removeAssetGroup: (groupId) => {
    const state = get();
    getAssetGroup(state.project, groupId);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeAssetGroup",
      before: captureRemoveAssetGroupPayload(state.project, groupId),
      after: null,
    });
  },

  updateAssetGroup: (groupId, patch, options) => {
    const state = get();
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateAssetGroup",
        groupId,
        before: captureAssetGroupPatch(state.project, groupId, patch),
        after: patch,
      },
      options
    );
  },

  placeAssetTreeItem: (item, placement) => {
    const state = get();
    const before = state.project;
    const bundle = cloneProjectBundle(getBundle(state));
    placeAssetTreeItemInProject(bundle.project, item, placement);
    const events = buildAssetTreeMoveEvents(before, bundle.project);
    if (events.length === 0) return;
    const mergeKey =
      item.kind === "expression"
        ? `asset-tree-move:expression:${item.actorId}:${item.id}`
        : `asset-tree-move:${item.kind}:${item.id}`;
    dispatchEventBatch(get, set, events, { mergeKey });
  },

  setSelection: (nodeIds, edgeIds) => {
    const state = get();
    const before = getSelectionSnapshot(getAppState(state));
    const after = buildSelectionAfterGraphSelection(nodeIds, edgeIds);
    if (sameSelectionSnapshot(before, after)) return;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "setSelection",
      before,
      after,
    });
  },
  setSelectedAssetId: (assetId) => {
    const state = get();
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "setSelectedAssetId",
      before: getSelectionSnapshot(getAppState(state)),
      after: buildSelectionAfterSelectAsset(assetId),
    });
  },
  setSelectedModuleId: (moduleId) => {
    const state = get();
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "setSelectedModuleId",
      before: getSelectionSnapshot(getAppState(state)),
      after: buildSelectionAfterSelectModule(moduleId),
    });
  },
  addModule: (name) => {
    const state = get();
    const bundle = cloneProjectBundle(getBundle(state));
    const module = addModuleInProject(bundle.project, name);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addModule",
      before: getSelectionSnapshot(getAppState(state)),
      after: {
        module,
        navigation: buildSelectionAfterSelectModule(module.id),
      },
    });
    return module;
  },
  removeModule: (moduleId) => {
    const state = get();
    const module = state.project.modules?.find((entry) => entry.id === moduleId);
    if (!module) return;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeModule",
      before: {
        module: JSON.parse(JSON.stringify(module)) as ModuleInterface,
        navigation: getSelectionSnapshot(getAppState(state)),
      },
      after: buildSelectionAfterSelectModule(
        state.selectedModuleId === moduleId ? null : state.selectedModuleId
      ),
    });
  },
  updateModule: (moduleId, patch, options) => {
    const state = get();
    const module = state.project.modules?.find((entry) => entry.id === moduleId);
    if (!module) return;
    const before: Partial<
      Pick<ModuleInterface, "name" | "bindingName" | "methods" | "typescriptSource">
    > = {};
    for (const key of Object.keys(patch) as Array<
      keyof Pick<ModuleInterface, "name" | "bindingName" | "methods" | "typescriptSource">
    >) {
      before[key] = JSON.parse(JSON.stringify(module[key])) as never;
    }
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateModule",
        moduleId,
        before,
        after: patch,
      },
      options
    );
  },
  clearSelection: () => {
    const state = get();
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "clearSelection",
      before: getSelectionSnapshot(getAppState(state)),
      after: buildEmptySelection(),
    });
  },
  setHighlightedRootNodeIds: (ids) => {
    const state = get();
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "setHighlightedRootNodeIds",
      before: [...state.highlightedRootNodeIds],
      after: [...ids],
    });
  },
  clearPlayValidationHighlight: () => {
    const state = get();
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "clearPlayValidationHighlight",
      before: [...state.highlightedRootNodeIds],
      after: [],
    });
  },

  dismissLoadWarnings: () => set({ loadWarnings: [] }),

  flushHistoryCoalesce: () => {
    const eventLog = flushEventLogCoalesce(get().eventLog);
    if (eventLog === get().eventLog) return;
    set({ eventLog, ...eventLogFlags(eventLog) });
    scheduleSaveToStorage(get);
  },

  beginHistoryTransaction: () => {
    const eventLog = beginEventTransaction(get().eventLog);
    set({ eventLog });
  },

  commitHistoryTransaction: () => {
    const { log } = commitEventTransaction(get().eventLog);
    set({ eventLog: log, ...eventLogFlags(log) });
    scheduleSaveToStorage(get);
  },

  cancelHistoryTransaction: () => {
    const eventLog = cancelEventTransaction(get().eventLog);
    set({ eventLog });
  },

  undo: () => applyEventStep(get, set, "backward"),

  redo: () => applyEventStep(get, set, "forward"),

  loadFromStorage: async () => {
    const loaded = await loadAutosaveFromPersistence();
    if (!loaded) return;
    const prepared = prepareLoadedAutosave(loaded);
    set({
      project: prepared.bundle.project,
      promptsByLocale: prepared.bundle.promptsByLocale,
      activeStoryId: prepared.session.activeStoryId,
      selectedNodeIds: prepared.session.selectedNodeIds,
      selectedEdgeIds: prepared.session.selectedEdgeIds,
      selectedAssetId: prepared.session.selectedAssetId,
      selectedModuleId: prepared.session.selectedModuleId,
      highlightedRootNodeIds: prepared.session.highlightedRootNodeIds,
      lastSavedSnapshot: prepared.lastSavedSnapshot,
      loadWarnings: prepared.loadWarnings,
      eventLog: prepared.session.eventLog,
      ...eventLogFlags(prepared.session.eventLog),
    });
  },

  saveToStorage: () => {
    void saveProjectStateToStorage({
      bundle: getBundle(get()),
      session: getStoredSessionFromState(get()),
    });
  },

  newProject: (name) => {
    const project = createStarterProject(name);
    const bundle = migrateProjectBundle(project);
    const snapshot = serializeProjectBundleSnapshot(bundle);
    const eventLog = clearEventLog(get().eventLog);
    const activeStoryId = getFirstStoryId(bundle.project);
    const session = emptyStoredSession(activeStoryId);
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
      selectedModuleId: null,
      highlightedRootNodeIds: [],
      loadWarnings: [],
      eventLog,
      ...eventLogFlags(eventLog),
    });
    void saveProjectStateToStorage({ bundle, session: { ...session, eventLog } });
    scheduleAssetBlobGc(eventLog, bundle.project);
  },

  hydrateAssets: async () => {
    isApplyingEvent = true;
    try {
      const bundle = cloneProjectBundle(getBundle(get()));
      await applyBlobKeyRemappings();
      await hydrateLegacyEmbeddedAssets(bundle.project);
      set({ project: bundle.project, promptsByLocale: bundle.promptsByLocale });
      scheduleSaveToStorage(get);
    } finally {
      isApplyingEvent = false;
    }
  },

  loadFromJson: async (json) => {
    const loadWarnings = validateStoredProjectJson(json);
    const bundle = sanitizeLoadedBundle(parseStoredProjectPayload(json));
    await applyBlobKeyRemappings(bundle);
    await hydrateLegacyEmbeddedAssets(bundle.project);
    const snapshot = serializeProjectBundleSnapshot(bundle);
    const eventLog = clearEventLog(get().eventLog);
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
      selectedModuleId: null,
      highlightedRootNodeIds: [],
      loadWarnings,
      eventLog,
      ...eventLogFlags(eventLog),
    });
    scheduleSaveToStorage(get);
    scheduleAssetBlobGc(eventLog, bundle.project);
  },

  loadFromArchive: async (data, mlvnPath = null) => {
    const unpacked = unpackProjectArchive(data);
    const { manifest, files, prompts, metadata } = unpacked;
    const loadWarnings = validateUnpackedArchive(unpacked);
    const project = parseProject(manifest);
    assertArchivePromptLocales(project.locales, prompts);
    const promptsByLocale: PromptsByLocale = {};
    for (const [locale, localePrompts] of prompts.entries()) {
      promptsByLocale[locale] = localePrompts;
    }
    const bundle = sanitizeLoadedBundle(migrateProjectBundle(project, promptsByLocale));
    await applyBlobKeyRemappings(bundle);
    const baseDir = await hydrateProjectAssets(bundle.project, { files, mlvnPath });
    const snapshot = serializeProjectBundleSnapshot(bundle);
    const eventLog = clearEventLog(get().eventLog);
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
      selectedModuleId: null,
      highlightedRootNodeIds: [],
      loadWarnings,
      eventLog,
      ...eventLogFlags(eventLog),
    });
    scheduleSaveToStorage(get);
    scheduleAssetBlobGc(eventLog, bundle.project);
  },

  exportArchive: async () => packProjectArchive(getBundle(get())),

  isDirty: () => serializeProjectBundleSnapshot(getBundle(get())) !== get().lastSavedSnapshot,

  markSaved: () => {
    set({ lastSavedSnapshot: serializeProjectBundleSnapshot(getBundle(get())) });
  },

  addNode: (position, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    const type: StoryNodeType = options?.type ?? "scene";
    const bundle = cloneProjectBundle(getBundle(state));
    const node = addNodeInProject(bundle.project, storyId, position, type);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addNode",
      storyId,
      before: null,
      after: node,
    });
    return node;
  },

  cloneNode: (nodeId, position) => {
    const state = get();
    const storyId = state.activeStoryId;
    const bundle = cloneProjectBundle(getBundle(state));
    const node = cloneNodeInProject(bundle.project, storyId, nodeId, position);
    if (!node) return null;
    cloneNodePrompts(bundle.promptsByLocale, storyId, nodeId, node.id);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "cloneNode",
      storyId,
      sourceNodeId: nodeId,
      before: null,
      after: {
        node,
        nodePromptsByLocale: captureNodePromptsByLocale(
          bundle.promptsByLocale,
          bundle.project.locales,
          storyId,
          node.id
        ),
      },
    });
    return node;
  },

  removeNode: (nodeId) => {
    const state = get();
    const storyId = state.activeStoryId;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeNode",
      storyId,
      before: captureRemoveNodePayload(getAppState(state), storyId, nodeId),
      after: null,
    });
  },

  updateNodePosition: (nodeId, position) => {
    get().updateNodePositions([{ nodeId, position }]);
  },

  updateNodePositions: (updates) => {
    const state = get();
    const storyId = state.activeStoryId;
    const story = getStory(state.project, storyId);
    const events: Extract<AppEvent, { type: "updateNodePosition" }>[] = [];

    for (const { nodeId, position } of updates) {
      const node = story.nodes.find((entry) => entry.id === nodeId);
      if (!node) continue;
      if (node.position.x === position.x && node.position.y === position.y) continue;
      events.push({
        ...createEventMeta(),
        type: "updateNodePosition",
        storyId,
        nodeId,
        before: { ...node.position },
        after: position,
      });
    }

    if (events.length === 0) return;

    const mergeKey =
      events.length === 1
        ? `node-position:${events[0].nodeId}`
        : `node-positions:${events
            .map((event) => event.nodeId)
            .sort()
            .join(",")}`;

    dispatchEventBatch(get, set, events, { mergeKey });
  },

  updateEndNodeLayout: (sceneId, patch, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    const story = getStory(state.project, storyId);
    const scene = story.nodes.find((entry) => entry.id === sceneId);
    if (!scene || !isSceneNode(scene)) return;

    const before = getEndNodeLayout(story, sceneId) ?? null;
    const after = mergeEndNodeLayout(before, patch, defaultEndNodePosition(scene.position));
    if (endNodeLayoutsEqual(before, after)) return;

    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateEndNodeLayout",
        storyId,
        sceneId,
        before,
        after,
      },
      {
        ...options,
        mergeKey: patch.position ? `end-node-position:${sceneId}` : options?.mergeKey,
      }
    );
  },

  updateNode: (nodeId, patch, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateNode",
        storyId,
        nodeId,
        before: captureNodePatch(state.project, storyId, nodeId, patch),
        after: patch,
      },
      options
    );
  },

  updateNodePrompt: (locale, nodeId, textTemplate, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    const tag = assertValidLocaleTag(locale);
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateNodePrompt",
        storyId,
        locale: tag,
        nodeId,
        before: getNodeTextTemplate(state.promptsByLocale[tag], storyId, nodeId),
        after: textTemplate,
      },
      options
    );
  },

  updateNodeSpeaker: (locale, nodeId, speaker, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    const tag = assertValidLocaleTag(locale);
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateNodeSpeaker",
        storyId,
        locale: tag,
        nodeId,
        before: getNodeSpeaker(state.promptsByLocale[tag], storyId, nodeId),
        after: speaker,
      },
      options
    );
  },

  updateEdgePrompt: (locale, edgeId, optionText, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    const tag = assertValidLocaleTag(locale);
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateEdgePrompt",
        storyId,
        locale: tag,
        edgeId,
        before: state.promptsByLocale[tag]?.stories[storyId]?.edges[edgeId]?.optionText,
        after: optionText,
      },
      options
    );
  },

  addLocale: (locale) => {
    const state = get();
    const tag = assertValidLocaleTag(locale);
    const localePrompts = createEmptyLocalePrompts();
    for (const story of state.project.stories) {
      localePrompts.stories[story.id] = { nodes: {}, edges: {} };
    }
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addLocale",
      locale: tag,
      before: null,
      after: { locale: tag, localePrompts },
    });
  },

  removeLocale: (locale) => {
    const state = get();
    const tag = assertValidLocaleTag(locale);
    const localePrompts = state.promptsByLocale[tag];
    if (!localePrompts) return;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeLocale",
      before: {
        locale: tag,
        localePrompts: JSON.parse(JSON.stringify(localePrompts)),
      },
      after: null,
    });
  },

  addEdge: (sourceNodeId, targetNodeId, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    const bundle = cloneProjectBundle(getBundle(state));
    const edge = addEdgeInProject(
      bundle.project,
      storyId,
      sourceNodeId,
      targetNodeId,
      options
    );
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addEdge",
      storyId,
      before: null,
      after: edge,
    });
    return edge;
  },

  removeEdge: (edgeId) => {
    const state = get();
    const storyId = state.activeStoryId;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeEdge",
      storyId,
      before: captureRemoveEdgePayload(getAppState(state), storyId, edgeId),
      after: null,
    });
  },

  updateEdge: (edgeId, patch, options) => {
    const state = get();
    const storyId = state.activeStoryId;
    const edge = getStory(state.project, storyId).edges.find((entry) => entry.id === edgeId);
    if (!edge) return;
    const before: Partial<Pick<StoryEdge, "condition" | "vertices" | "manualRoute">> = {};
    for (const key of Object.keys(patch) as Array<keyof typeof before>) {
      before[key] = JSON.parse(JSON.stringify(edge[key])) as never;
    }
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateEdge",
        storyId,
        edgeId,
        before,
        after: patch,
      },
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

    const state = get();
    const storesBlob = Boolean(options.file && !isElectron());
    const bundle = cloneProjectBundle(getBundle(state));
    let asset = addAssetInProject(bundle.project, type, name, {
      path: options.path,
      url: options.file ? undefined : options.url,
    });
    if (storesBlob) {
      replaceAssetMediaInProject(bundle.project, asset.id, { blobStored: true });
      asset = bundle.project.assets.find((entry) => entry.id === asset.id) ?? asset;
    }
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addAsset",
      before: null,
      after: asset,
    });
    if (options.file && !isElectron()) {
      await putAssetBlob(asset.id, await fileToStoredBlob(options.file));
    }
    return asset;
  },

  addBlankActor: (name = "New actor") => {
    const state = get();
    const bundle = cloneProjectBundle(getBundle(state));
    const asset = addBlankActorInProject(bundle.project, name);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addBlankActor",
      before: null,
      after: asset,
    });
    return asset;
  },

  addActorFromImage: async (name, options = {}) => {
    const state = get();
    const storesBlob = Boolean(options.file && !isElectron());
    const bundle = cloneProjectBundle(getBundle(state));
    const asset = addActorFromImageInProject(bundle.project, name, {
      path: options.path,
      blobStored: storesBlob,
    });
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addActorFromImage",
      before: null,
      after: asset,
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
    const state = get();
    const bundle = cloneProjectBundle(getBundle(state));
    const expression = addActorExpressionInProject(bundle.project, actorId, name);
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "addActorExpression",
      actorId,
      before: null,
      after: expression,
    });
    return expression;
  },

  updateActorExpression: (actorId, expressionId, patch, options) => {
    const state = get();
    const asset = state.project.assets.find((entry) => entry.id === actorId);
    const expression = asset?.expressions?.find((entry) => entry.id === expressionId);
    if (!expression) return;
    const before: Partial<Pick<ActorExpression, "name">> = {};
    for (const key of Object.keys(patch) as Array<keyof typeof before>) {
      before[key] = JSON.parse(JSON.stringify(expression[key])) as never;
    }
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateActorExpression",
        actorId,
        expressionId,
        before,
        after: patch,
      },
      options
    );
  },

  replaceActorExpressionMedia: async (actorId, expressionId, options) => {
    const state = get();
    const asset = state.project.assets.find((entry) => entry.id === actorId);
    const expression = asset?.expressions?.find((entry) => entry.id === expressionId);
    if (!expression) return;
    const before = {
      path: expression.path,
      url: expression.url,
      blobStored: expression.blobStored,
    };
    const after = {
      path: options.path,
      url: undefined as string | undefined,
      blobStored: Boolean(!isElectron() && options.file),
    };
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "replaceActorExpressionMedia",
      actorId,
      expressionId,
      before,
      after,
    });
    const blobKey = expressionBlobKey(actorId, expressionId);
    if (!isElectron() && options.file) {
      revokeWebAssetObjectUrl(blobKey);
      await putAssetBlob(blobKey, await fileToStoredBlob(options.file));
    }
  },

  removeActorExpression: (actorId, expressionId) => {
    const state = get();
    const asset = state.project.assets.find((entry) => entry.id === actorId);
    const expression = asset?.expressions?.find((entry) => entry.id === expressionId);
    if (!expression) return;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeActorExpression",
      actorId,
      before: JSON.parse(JSON.stringify(expression)) as ActorExpression,
      after: null,
    });
    void deleteAssetBlob(expressionBlobKey(actorId, expressionId));
  },

  updateAsset: (assetId, patch, options) => {
    const state = get();
    const asset = state.project.assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    const before: Partial<
      Pick<
        Asset,
        "name" | "personality" | "appearance" | "voiceAccent" | "backstory" | "notes" | "expressions" | "defaultExpressionId" | "groupId" | "sortOrder"
      >
    > = {};
    for (const key of Object.keys(patch) as Array<keyof typeof before>) {
      before[key] = capturePatchValue(asset[key]) as never;
    }
    dispatchEvent(
      get,
      set,
      {
        ...createEventMeta(),
        type: "updateAsset",
        assetId,
        before,
        after: patch,
      },
      options
    );
  },

  replaceAssetMedia: async (assetId, options) => {
    if (!canReplaceAsset(assetId)) return;
    const state = get();
    const asset = state.project.assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    const before = {
      path: asset.path,
      url: asset.url,
      blobStored: asset.blobStored,
    };
    const after = {
      path: options.path,
      url: undefined as string | undefined,
      blobStored: Boolean(!isElectron() && options.file),
    };
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "replaceAssetMedia",
      assetId,
      before,
      after,
    });
    if (!isElectron() && options.file) {
      revokeWebAssetObjectUrl(assetId);
      await putAssetBlob(assetId, await fileToStoredBlob(options.file));
    }
  },

  removeAsset: async (assetId) => {
    if (!canRemoveAsset(assetId)) return;
    const state = get();
    const asset = state.project.assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    dispatchEvent(get, set, {
      ...createEventMeta(),
      type: "removeAsset",
      before: {
        asset: JSON.parse(JSON.stringify(asset)) as Asset,
        navigation: getSelectionSnapshot(getAppState(state)),
      },
      after: buildSelectionAfterSelectAsset(
        state.selectedAssetId === assetId ? null : state.selectedAssetId
      ),
    });
  },

  getEntryNodeId: () => getEntryNodeId(get().project, get().activeStoryId),
}));

export async function bootstrapProjectStore(): Promise<void> {
  const loaded = await loadAutosaveFromPersistence();
  if (loaded) {
    if (isElectron()) {
      const prepared = prepareLoadedAutosave(loaded);
      useProjectStore.setState({
        project: prepared.bundle.project,
        promptsByLocale: prepared.bundle.promptsByLocale,
        activeStoryId: prepared.session.activeStoryId,
        selectedNodeIds: prepared.session.selectedNodeIds,
        selectedEdgeIds: prepared.session.selectedEdgeIds,
        selectedAssetId: prepared.session.selectedAssetId,
        selectedModuleId: prepared.session.selectedModuleId,
        highlightedRootNodeIds: prepared.session.highlightedRootNodeIds,
        lastSavedSnapshot: prepared.lastSavedSnapshot,
        loadWarnings: prepared.loadWarnings,
        eventLog: prepared.session.eventLog,
        ...eventLogFlags(prepared.session.eventLog),
      });
      scheduleAssetBlobGc(prepared.session.eventLog, prepared.bundle.project);
    }
    return;
  }

  useProjectStore.getState().newProject();
}

export async function flushAutosave(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const state = persistGetState?.() ?? useProjectStore.getState();
  await saveProjectStateToStorage({
    bundle: getBundle(state),
    session: getStoredSessionFromState(state),
  });
}

export type { PromptsByLocale };
