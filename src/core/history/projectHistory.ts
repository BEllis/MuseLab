import type { ProjectBundle } from "@/core/model/projectBundle";
import { cloneProjectBundle } from "@/core/model/projectBundle";
import type { Project } from "@/core/model/types";
export { collectAssetIdsFromProject } from "./projectHistoryAssets";

export const DEFAULT_HISTORY_MAX_DEPTH = 50;

export type HistoryState = {
  past: ProjectBundle[];
  future: ProjectBundle[];
  maxDepth: number;
  coalesceKey: string | null;
  transactionDepth: number;
  transactionSnapshot: ProjectBundle | null;
};

export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

export function createHistoryState(maxDepth = DEFAULT_HISTORY_MAX_DEPTH): HistoryState {
  return {
    past: [],
    future: [],
    maxDepth,
    coalesceKey: null,
    transactionDepth: 0,
    transactionSnapshot: null,
  };
}

export function canUndoHistory(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedoHistory(history: HistoryState): boolean {
  return history.future.length > 0;
}

export function clearHistory(history: HistoryState): HistoryState {
  return {
    ...history,
    past: [],
    future: [],
    coalesceKey: null,
    transactionDepth: 0,
    transactionSnapshot: null,
  };
}

export function flushHistoryCoalesce(history: HistoryState): HistoryState {
  if (history.coalesceKey === null) return history;
  return { ...history, coalesceKey: null };
}

export function beginHistoryTransaction(
  history: HistoryState,
  currentBundle: ProjectBundle
): HistoryState {
  if (history.transactionDepth > 0) {
    return { ...history, transactionDepth: history.transactionDepth + 1 };
  }
  return {
    ...history,
    transactionDepth: 1,
    transactionSnapshot: cloneProjectBundle(currentBundle),
  };
}

export function commitHistoryTransaction(history: HistoryState): {
  history: HistoryState;
  shouldRecord: boolean;
  snapshot: ProjectBundle | null;
} {
  if (history.transactionDepth <= 0) {
    return { history, shouldRecord: false, snapshot: null };
  }
  if (history.transactionDepth > 1) {
    return {
      history: { ...history, transactionDepth: history.transactionDepth - 1 },
      shouldRecord: false,
      snapshot: null,
    };
  }
  const snapshot = history.transactionSnapshot;
  return {
    history: {
      ...history,
      transactionDepth: 0,
      transactionSnapshot: null,
    },
    shouldRecord: snapshot !== null,
    snapshot,
  };
}

export function cancelHistoryTransaction(history: HistoryState): HistoryState {
  if (history.transactionDepth <= 1) {
    return { ...history, transactionDepth: 0, transactionSnapshot: null };
  }
  return { ...history, transactionDepth: history.transactionDepth - 1 };
}

export function shouldRecordHistory(
  history: HistoryState,
  options?: { record?: boolean; mergeKey?: string }
): boolean {
  if (options?.record === false) return false;
  if (history.transactionDepth > 0) return false;
  return true;
}

export function recordHistorySnapshot(
  history: HistoryState,
  beforeBundle: ProjectBundle,
  mergeKey?: string
): HistoryState {
  const snapshot = cloneProjectBundle(beforeBundle);
  const coalescing = mergeKey !== undefined && mergeKey === history.coalesceKey;

  if (coalescing) {
    return { ...history, coalesceKey: mergeKey };
  }

  const past = [...history.past, snapshot];
  while (past.length > history.maxDepth) {
    past.shift();
  }

  return {
    ...history,
    past,
    future: [],
    coalesceKey: mergeKey ?? null,
  };
}

export function pushHistoryFromSnapshot(
  history: HistoryState,
  snapshot: ProjectBundle
): HistoryState {
  const past = [...history.past, cloneProjectBundle(snapshot)];
  while (past.length > history.maxDepth) {
    past.shift();
  }
  return {
    ...history,
    past,
    future: [],
    coalesceKey: null,
  };
}

export function undoHistory(
  history: HistoryState,
  currentBundle: ProjectBundle
): { history: HistoryState; bundle: ProjectBundle | null } {
  if (history.past.length === 0) {
    return { history, bundle: null };
  }

  const past = [...history.past];
  const bundle = past.pop()!;
  const future = [cloneProjectBundle(currentBundle), ...history.future];

  return {
    history: {
      ...history,
      past,
      future,
      coalesceKey: null,
      transactionDepth: 0,
      transactionSnapshot: null,
    },
    bundle,
  };
}

export function redoHistory(
  history: HistoryState,
  currentBundle: ProjectBundle
): { history: HistoryState; bundle: ProjectBundle | null } {
  if (history.future.length === 0) {
    return { history, bundle: null };
  }

  const future = [...history.future];
  const bundle = future.shift()!;
  const past = [...history.past, cloneProjectBundle(currentBundle)];

  while (past.length > history.maxDepth) {
    past.shift();
  }

  return {
    history: {
      ...history,
      past,
      future,
      coalesceKey: null,
      transactionDepth: 0,
      transactionSnapshot: null,
    },
    bundle,
  };
}

export function collectAssetIdsFromHistory(history: HistoryState): Set<string> {
  const ids = new Set<string>();
  for (const snapshot of history.past) {
    for (const asset of snapshot.project.assets) {
      ids.add(asset.id);
    }
  }
  for (const snapshot of history.future) {
    for (const asset of snapshot.project.assets) {
      ids.add(asset.id);
    }
  }
  return ids;
}
