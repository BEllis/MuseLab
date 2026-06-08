import type { Project } from "@/core/model/types";

export const DEFAULT_HISTORY_MAX_DEPTH = 50;

export type HistoryState = {
  past: Project[];
  future: Project[];
  maxDepth: number;
  coalesceKey: string | null;
  transactionDepth: number;
  transactionSnapshot: Project | null;
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
  currentProject: Project
): HistoryState {
  if (history.transactionDepth > 0) {
    return { ...history, transactionDepth: history.transactionDepth + 1 };
  }
  return {
    ...history,
    transactionDepth: 1,
    transactionSnapshot: cloneProject(currentProject),
  };
}

export function commitHistoryTransaction(history: HistoryState): {
  history: HistoryState;
  shouldRecord: boolean;
  snapshot: Project | null;
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
  beforeProject: Project,
  mergeKey?: string
): HistoryState {
  const snapshot = cloneProject(beforeProject);
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
  snapshot: Project
): HistoryState {
  const past = [...history.past, cloneProject(snapshot)];
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
  currentProject: Project
): { history: HistoryState; project: Project | null } {
  if (history.past.length === 0) {
    return { history, project: null };
  }

  const past = [...history.past];
  const project = past.pop()!;
  const future = [cloneProject(currentProject), ...history.future];

  return {
    history: {
      ...history,
      past,
      future,
      coalesceKey: null,
      transactionDepth: 0,
      transactionSnapshot: null,
    },
    project,
  };
}

export function redoHistory(
  history: HistoryState,
  currentProject: Project
): { history: HistoryState; project: Project | null } {
  if (history.future.length === 0) {
    return { history, project: null };
  }

  const future = [...history.future];
  const project = future.shift()!;
  const past = [...history.past, cloneProject(currentProject)];

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
    project,
  };
}

export function collectAssetIdsFromProject(project: Project): Set<string> {
  return new Set(project.assets.map((asset) => asset.id));
}

export function collectAssetIdsFromHistory(history: HistoryState): Set<string> {
  const ids = new Set<string>();
  for (const snapshot of history.past) {
    for (const asset of snapshot.assets) {
      ids.add(asset.id);
    }
  }
  for (const snapshot of history.future) {
    for (const asset of snapshot.assets) {
      ids.add(asset.id);
    }
  }
  return ids;
}
