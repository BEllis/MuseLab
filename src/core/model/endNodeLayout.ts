import type { EndNodeLayout, Story, StoryEdge } from "./types";
import { isSceneNode } from "./nodeTypes";
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from "@/utils/nodeOverlap";

export type { EndNodeLayout };

const END_NODE_SIZE = 52;
/** Horizontal gap between the scene's right edge and the End node. */
export const END_NODE_GAP = 36;

function sceneHasOutgoingLink(story: Story, sceneId: string): boolean {
  return story.edges.some((edge) => edge.sourceNodeId === sceneId);
}

export function getTerminalSceneIds(story: Story): string[] {
  return story.nodes
    .filter((node) => isSceneNode(node) && !sceneHasOutgoingLink(story, node.id))
    .map((node) => node.id);
}

export function endNodePositionForSceneBounds(
  scenePosition: { x: number; y: number },
  sceneSize: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: scenePosition.x + sceneSize.width + END_NODE_GAP,
    y: scenePosition.y + (sceneSize.height - END_NODE_SIZE) / 2,
  };
}

export function defaultEndNodePosition(scenePosition: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return endNodePositionForSceneBounds(scenePosition, {
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  });
}

export function getEndNodeLayout(story: Story, sceneId: string): EndNodeLayout | undefined {
  return story.endNodeLayouts?.[sceneId];
}

export function resolveEndNodePosition(
  _story: Story,
  _sceneId: string,
  scenePosition: { x: number; y: number },
  sceneSize: { width: number; height: number } = {
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  }
): { x: number; y: number } {
  return endNodePositionForSceneBounds(scenePosition, sceneSize);
}

/** Drop legacy designer-only end node layout; position now follows the parent scene. */
export function normalizeEndNodeLayouts(story: Story): void {
  if (!story.endNodeLayouts) return;
  delete story.endNodeLayouts;
}

export function setEndNodeLayout(
  story: Story,
  sceneId: string,
  layout: EndNodeLayout
): void {
  if (!story.endNodeLayouts) {
    story.endNodeLayouts = {};
  }
  story.endNodeLayouts[sceneId] = layout;
}

export function clearEndNodeLayout(story: Story, sceneId: string): void {
  if (!story.endNodeLayouts?.[sceneId]) return;
  delete story.endNodeLayouts[sceneId];
  if (Object.keys(story.endNodeLayouts).length === 0) {
    delete story.endNodeLayouts;
  }
}

export function pruneEndNodeLayouts(story: Story): void {
  if (!story.endNodeLayouts) return;
  const terminalSceneIds = new Set(getTerminalSceneIds(story));
  for (const sceneId of Object.keys(story.endNodeLayouts)) {
    if (!terminalSceneIds.has(sceneId)) {
      delete story.endNodeLayouts[sceneId];
    }
  }
  if (Object.keys(story.endNodeLayouts).length === 0) {
    delete story.endNodeLayouts;
  }
}

export function mergeEndNodeLayout(
  existing: EndNodeLayout | null | undefined,
  patch: Partial<EndNodeLayout>,
  fallbackPosition: { x: number; y: number }
): EndNodeLayout {
  const position = patch.position ?? existing?.position ?? fallbackPosition;
  const next: EndNodeLayout = { position: { ...position } };

  if (patch.vertices !== undefined) {
    next.vertices = patch.vertices.length > 0 ? patch.vertices.map((point) => ({ ...point })) : undefined;
  } else if (existing?.vertices) {
    next.vertices = existing.vertices.map((point) => ({ ...point }));
  }

  if (patch.manualRoute !== undefined) {
    next.manualRoute = patch.manualRoute || undefined;
  } else if (existing?.manualRoute) {
    next.manualRoute = existing.manualRoute;
  }

  if (!next.vertices?.length) {
    delete next.vertices;
    delete next.manualRoute;
  }

  return next;
}

export function isManualEndEdgeRoute(_layout: EndNodeLayout | undefined): boolean {
  return false;
}

export function getEndEdgeRouter(_layout: EndNodeLayout | undefined) {
  return {
    name: "manhattan" as const,
    args: {
      padding: 12,
      step: 10,
      startDirections: ["right"],
      endDirections: ["left"],
      excludeTerminals: ["source", "target"] as ("source" | "target")[],
    },
  };
}

export function getEndEdgeVertices(_layout: EndNodeLayout | undefined): { x: number; y: number }[] {
  return [];
}

export function endNodeLayoutFromEdgePatch(
  existing: EndNodeLayout | null | undefined,
  fallbackPosition: { x: number; y: number },
  patch: Pick<StoryEdge, "vertices" | "manualRoute">
): EndNodeLayout {
  return mergeEndNodeLayout(existing, patch, fallbackPosition);
}

function pointsEqual(
  left: { x: number; y: number } | undefined,
  right: { x: number; y: number } | undefined
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.x === right.x && left.y === right.y;
}

export function endNodeLayoutsEqual(
  left: EndNodeLayout | null | undefined,
  right: EndNodeLayout | null | undefined
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (!pointsEqual(left.position, right.position)) return false;
  if ((left.manualRoute ?? false) !== (right.manualRoute ?? false)) return false;
  const leftVertices = left.vertices ?? [];
  const rightVertices = right.vertices ?? [];
  if (leftVertices.length !== rightVertices.length) return false;
  return leftVertices.every((point, index) => pointsEqual(point, rightVertices[index]));
}
