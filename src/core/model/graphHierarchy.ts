import type { Project } from "./types";

/** Scene ids with no incoming edges (top-level / entry candidates). */
export function getRootNodeIds(project: Project): string[] {
  const hasIncoming = new Set(project.edges.map((edge) => edge.targetNodeId));
  return project.nodes.filter((node) => !hasIncoming.has(node.id)).map((node) => node.id);
}

export type PlayEntryValidation =
  | { ok: true; entryNodeId: string }
  | {
      ok: false;
      reason: "no_nodes" | "no_entry" | "multiple_entries";
      rootNodeIds: string[];
    };

export function validatePlayEntry(project: Project): PlayEntryValidation {
  if (project.nodes.length === 0) {
    return { ok: false, reason: "no_nodes", rootNodeIds: [] };
  }

  const rootNodeIds = getRootNodeIds(project);

  if (rootNodeIds.length === 0) {
    return { ok: false, reason: "no_entry", rootNodeIds: [] };
  }

  if (rootNodeIds.length > 1) {
    return { ok: false, reason: "multiple_entries", rootNodeIds };
  }

  return { ok: true, entryNodeId: rootNodeIds[0] };
}

/** Unique starting scene for play, or null when ambiguous or missing. */
export function getPlayEntryNodeId(project: Project): string | null {
  const validation = validatePlayEntry(project);
  return validation.ok ? validation.entryNodeId : null;
}
