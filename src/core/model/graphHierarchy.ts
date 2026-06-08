import type { Story } from "./types";
import { findDuplicateNodeNames } from "./nodeNames";
import { getStartNodes, isStartNode } from "./nodeTypes";

export type PlayEntryValidation =
  | { ok: true; entryNodeId: string }
  | {
      ok: false;
      reason:
        | "no_nodes"
        | "no_starts"
        | "no_entry_configured"
        | "invalid_entry"
        | "duplicate_names";
      duplicateNames?: string[];
      entryNodeId?: string;
    };

export function validatePlayEntry(story: Story): PlayEntryValidation {
  if (story.nodes.length === 0) {
    return { ok: false, reason: "no_nodes" };
  }

  const duplicateNames = findDuplicateNodeNames(story);
  if (duplicateNames.length > 0) {
    return { ok: false, reason: "duplicate_names", duplicateNames };
  }

  const startNodes = getStartNodes(story);
  if (startNodes.length === 0) {
    return { ok: false, reason: "no_starts" };
  }

  if (!story.entryNodeId) {
    return { ok: false, reason: "no_entry_configured" };
  }

  const entryNode = story.nodes.find((node) => node.id === story.entryNodeId);
  if (!entryNode || !isStartNode(entryNode)) {
    return {
      ok: false,
      reason: "invalid_entry",
      entryNodeId: story.entryNodeId,
    };
  }

  return { ok: true, entryNodeId: story.entryNodeId };
}

/** Configured starting node for play, or null when invalid. */
export function getPlayEntryNodeId(story: Story): string | null {
  const validation = validatePlayEntry(story);
  return validation.ok ? validation.entryNodeId : null;
}

export function validateAllStories(
  stories: Story[]
): { storyId: string; storyName: string; validation: Extract<PlayEntryValidation, { ok: false }> } | null {
  for (const story of stories) {
    const validation = validatePlayEntry(story);
    if (!validation.ok) {
      return { storyId: story.id, storyName: story.name, validation };
    }
  }
  return null;
}
