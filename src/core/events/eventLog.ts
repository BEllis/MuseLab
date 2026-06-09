import type { AppEvent } from "./types";
import { createEventMeta } from "./appState";

export const DEFAULT_EVENT_LOG_MAX_DEPTH = 50;

export type EventLogState = {
  events: AppEvent[];
  cursor: number;
  maxDepth: number;
  coalesceKey: string | null;
  transactionDepth: number;
  transactionBuffer: AppEvent[];
};

export function createEventLogState(maxDepth = DEFAULT_EVENT_LOG_MAX_DEPTH): EventLogState {
  return {
    events: [],
    cursor: -1,
    maxDepth,
    coalesceKey: null,
    transactionDepth: 0,
    transactionBuffer: [],
  };
}

export function canUndoEventLog(log: EventLogState): boolean {
  return log.cursor >= 0;
}

export function canRedoEventLog(log: EventLogState): boolean {
  return log.cursor < log.events.length - 1;
}

export function clearEventLog(log: EventLogState): EventLogState {
  return {
    ...log,
    events: [],
    cursor: -1,
    coalesceKey: null,
    transactionDepth: 0,
    transactionBuffer: [],
  };
}

export function flushEventLogCoalesce(log: EventLogState): EventLogState {
  if (log.coalesceKey === null) return log;
  return { ...log, coalesceKey: null };
}

export function shouldRecordEvent(
  log: EventLogState,
  options?: { record?: boolean }
): boolean {
  if (options?.record === false) return false;
  return true;
}

export function beginEventTransaction(log: EventLogState): EventLogState {
  if (log.transactionDepth > 0) {
    return { ...log, transactionDepth: log.transactionDepth + 1 };
  }
  return {
    ...log,
    transactionDepth: 1,
    transactionBuffer: [],
  };
}

export function cancelEventTransaction(log: EventLogState): EventLogState {
  if (log.transactionDepth <= 1) {
    return {
      ...log,
      transactionDepth: 0,
      transactionBuffer: [],
    };
  }
  return { ...log, transactionDepth: log.transactionDepth - 1 };
}

export function commitEventTransaction(log: EventLogState): {
  log: EventLogState;
  batchEvent: AppEvent | null;
} {
  if (log.transactionDepth <= 0) {
    return { log, batchEvent: null };
  }
  if (log.transactionDepth > 1) {
    return {
      log: { ...log, transactionDepth: log.transactionDepth - 1 },
      batchEvent: null,
    };
  }

  const buffered = log.transactionBuffer;
  const nextLog: EventLogState = {
    ...log,
    transactionDepth: 0,
    transactionBuffer: [],
  };

  if (buffered.length === 0) {
    return { log: nextLog, batchEvent: null };
  }

  const batchEvent: AppEvent =
    buffered.length === 1
      ? buffered[0]
      : {
          ...createEventMeta(),
          type: "batch",
          events: buffered,
        };

  return { log: appendRecordedEvent(nextLog, batchEvent), batchEvent: null };
}

function trimEventLog(log: EventLogState): EventLogState {
  let { events, cursor, maxDepth } = log;
  while (events.length > maxDepth) {
    events = events.slice(1);
    cursor -= 1;
  }
  return { ...log, events, cursor };
}

function coalesceEvent(existing: AppEvent, incoming: AppEvent): AppEvent | null {
  if (existing.type !== incoming.type) return null;

  switch (incoming.type) {
    case "updateProject":
      if (existing.type !== "updateProject") return null;
      return { ...existing, after: incoming.after };
    case "updateStory":
      if (existing.type !== "updateStory" || existing.storyId !== incoming.storyId) return null;
      return { ...existing, after: incoming.after };
    case "updateNode":
      if (
        existing.type !== "updateNode" ||
        existing.storyId !== incoming.storyId ||
        existing.nodeId !== incoming.nodeId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateNodePosition":
      if (
        existing.type !== "updateNodePosition" ||
        existing.storyId !== incoming.storyId ||
        existing.nodeId !== incoming.nodeId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateEndNodeLayout":
      if (
        existing.type !== "updateEndNodeLayout" ||
        existing.storyId !== incoming.storyId ||
        existing.sceneId !== incoming.sceneId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateEdge":
      if (
        existing.type !== "updateEdge" ||
        existing.storyId !== incoming.storyId ||
        existing.edgeId !== incoming.edgeId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateNodePrompt":
      if (
        existing.type !== "updateNodePrompt" ||
        existing.storyId !== incoming.storyId ||
        existing.locale !== incoming.locale ||
        existing.nodeId !== incoming.nodeId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateNodeSpeaker":
      if (
        existing.type !== "updateNodeSpeaker" ||
        existing.storyId !== incoming.storyId ||
        existing.locale !== incoming.locale ||
        existing.nodeId !== incoming.nodeId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateEdgePrompt":
      if (
        existing.type !== "updateEdgePrompt" ||
        existing.storyId !== incoming.storyId ||
        existing.locale !== incoming.locale ||
        existing.edgeId !== incoming.edgeId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateAsset":
      if (existing.type !== "updateAsset" || existing.assetId !== incoming.assetId) return null;
      return { ...existing, after: incoming.after };
    case "updateActorExpression":
      if (
        existing.type !== "updateActorExpression" ||
        existing.actorId !== incoming.actorId ||
        existing.expressionId !== incoming.expressionId
      ) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "updateModule":
      if (existing.type !== "updateModule" || existing.moduleId !== incoming.moduleId) {
        return null;
      }
      return { ...existing, after: incoming.after };
    case "batch":
      if (existing.type !== "batch") return null;
      return incoming;
    default:
      return null;
  }
}

export function appendRecordedEvent(
  log: EventLogState,
  event: AppEvent,
  mergeKey?: string
): EventLogState {
  const coalescing =
    mergeKey !== undefined &&
    mergeKey === log.coalesceKey &&
    log.cursor >= 0 &&
    log.events[log.cursor];

  if (coalescing) {
    const merged = coalesceEvent(log.events[log.cursor], event);
    if (merged) {
      const events = [...log.events];
      events[log.cursor] = merged;
      return trimEventLog({ ...log, events, coalesceKey: mergeKey });
    }
  }

  const events = log.events.slice(0, log.cursor + 1);
  events.push(event);
  return trimEventLog({
    ...log,
    events,
    cursor: events.length - 1,
    coalesceKey: mergeKey ?? null,
  });
}

export function recordEvent(
  log: EventLogState,
  event: AppEvent,
  options?: { mergeKey?: string }
): EventLogState {
  if (log.transactionDepth > 0) {
    return {
      ...log,
      transactionBuffer: [...log.transactionBuffer, event],
    };
  }
  return appendRecordedEvent(log, event, options?.mergeKey);
}

export function getUndoEvent(log: EventLogState): AppEvent | null {
  if (log.cursor < 0) return null;
  return log.events[log.cursor] ?? null;
}

export function getRedoEvent(log: EventLogState): AppEvent | null {
  if (log.cursor >= log.events.length - 1) return null;
  return log.events[log.cursor + 1] ?? null;
}

export function stepEventLogCursor(log: EventLogState, delta: -1 | 1): EventLogState {
  return {
    ...log,
    cursor: log.cursor + delta,
    coalesceKey: null,
    transactionDepth: 0,
    transactionBuffer: [],
  };
}

export function collectEventsFromLog(log: EventLogState): AppEvent[] {
  return log.events;
}
