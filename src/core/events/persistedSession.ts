import type { AppState } from "./appState";
import {
  createEventLogState,
  DEFAULT_EVENT_LOG_MAX_DEPTH,
  type EventLogState,
} from "./eventLog";
import type { AppEvent } from "./types";

export type SerializedEventLog = {
  events: AppEvent[];
  cursor: number;
  maxDepth?: number;
};

export type StoredProjectSession = {
  activeStoryId: string;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedAssetId: string | null;
  selectedServiceId: string | null;
  highlightedRootNodeIds: string[];
  eventLog: EventLogState;
};

export type PersistedSessionPayload = Omit<StoredProjectSession, "eventLog"> & {
  eventLog: SerializedEventLog;
};

export type StoreSessionState = StoredProjectSession;

export function serializeEventLogForStorage(log: EventLogState): SerializedEventLog {
  return {
    events: log.events,
    cursor: log.cursor,
    maxDepth: log.maxDepth,
  };
}

export function parseEventLogFromStorage(data: unknown): EventLogState | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.events)) return null;
  if (typeof record.cursor !== "number" || !Number.isInteger(record.cursor)) return null;

  const events = record.events as AppEvent[];
  const cursor = record.cursor;
  if (cursor < -1 || cursor >= events.length) return null;

  const maxDepth =
    typeof record.maxDepth === "number" && record.maxDepth > 0
      ? record.maxDepth
      : DEFAULT_EVENT_LOG_MAX_DEPTH;

  return {
    events,
    cursor,
    maxDepth,
    coalesceKey: null,
    transactionDepth: 0,
    transactionBuffer: [],
  };
}

export function serializeSessionForStorage(session: StoredProjectSession): PersistedSessionPayload {
  return {
    activeStoryId: session.activeStoryId,
    selectedNodeIds: [...session.selectedNodeIds],
    selectedEdgeIds: [...session.selectedEdgeIds],
    selectedAssetId: session.selectedAssetId,
    selectedServiceId: session.selectedServiceId,
    highlightedRootNodeIds: [...session.highlightedRootNodeIds],
    eventLog: serializeEventLogForStorage(session.eventLog),
  };
}

export function parseSessionFromStorage(data: unknown): StoredProjectSession | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.activeStoryId !== "string") return null;

  const eventLog = parseEventLogFromStorage(record.eventLog);
  if (!eventLog) return null;

  return {
    activeStoryId: record.activeStoryId,
    selectedNodeIds: Array.isArray(record.selectedNodeIds)
      ? record.selectedNodeIds.filter((id): id is string => typeof id === "string")
      : [],
    selectedEdgeIds: Array.isArray(record.selectedEdgeIds)
      ? record.selectedEdgeIds.filter((id): id is string => typeof id === "string")
      : [],
    selectedAssetId: typeof record.selectedAssetId === "string" ? record.selectedAssetId : null,
    selectedServiceId:
      typeof record.selectedServiceId === "string" ? record.selectedServiceId : null,
    highlightedRootNodeIds: Array.isArray(record.highlightedRootNodeIds)
      ? record.highlightedRootNodeIds.filter((id): id is string => typeof id === "string")
      : [],
    eventLog,
  };
}

export function sessionFromStoreState(state: StoreSessionState): StoredProjectSession {
  return {
    activeStoryId: state.activeStoryId,
    selectedNodeIds: [...state.selectedNodeIds],
    selectedEdgeIds: [...state.selectedEdgeIds],
    selectedAssetId: state.selectedAssetId,
    selectedServiceId: state.selectedServiceId,
    highlightedRootNodeIds: [...state.highlightedRootNodeIds],
    eventLog: state.eventLog,
  };
}

export function applyStoredSessionToAppState(
  state: AppState,
  session: StoredProjectSession
): AppState {
  return {
    ...state,
    activeStoryId: session.activeStoryId,
    selectedNodeIds: [...session.selectedNodeIds],
    selectedEdgeIds: [...session.selectedEdgeIds],
    selectedAssetId: session.selectedAssetId,
    selectedServiceId: session.selectedServiceId,
    highlightedRootNodeIds: [...session.highlightedRootNodeIds],
  };
}

export function emptyStoredSession(activeStoryId: string): StoredProjectSession {
  return {
    activeStoryId,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedAssetId: null,
    selectedServiceId: null,
    highlightedRootNodeIds: [],
    eventLog: createEventLogState(),
  };
}
