import type { EndNodeLayout, Story, StoryEdge } from "./types";
import { isSceneNode } from "./nodeTypes";
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH, MIN_NODE_GAP } from "@/utils/nodeOverlap";

export type { EndNodeLayout };

const END_NODE_SIZE = 52;

function sceneHasOutgoingLink(story: Story, sceneId: string): boolean {
  return story.edges.some((edge) => edge.sourceNodeId === sceneId);
}

export function getTerminalSceneIds(story: Story): string[] {
  return story.nodes
    .filter((node) => isSceneNode(node) && !sceneHasOutgoingLink(story, node.id))
    .map((node) => node.id);
}

export function defaultEndNodePosition(scenePosition: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: scenePosition.x + DEFAULT_NODE_WIDTH + MIN_NODE_GAP,
    y: scenePosition.y + (DEFAULT_NODE_HEIGHT - END_NODE_SIZE) / 2,
  };
}

export function getEndNodeLayout(story: Story, sceneId: string): EndNodeLayout | undefined {
  return story.endNodeLayouts?.[sceneId];
}

export function resolveEndNodePosition(
  story: Story,
  sceneId: string,
  scenePosition: { x: number; y: number }
): { x: number; y: number } {
  return getEndNodeLayout(story, sceneId)?.position ?? defaultEndNodePosition(scenePosition);
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

export function isManualEndEdgeRoute(layout: EndNodeLayout | undefined): boolean {
  return layout?.manualRoute === true || (layout?.vertices?.length ?? 0) > 0;
}

export function getEndEdgeRouter(layout: EndNodeLayout | undefined) {
  return isManualEndEdgeRoute(layout)
    ? { name: "normal" as const }
    : {
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

export function getEndEdgeVertices(layout: EndNodeLayout | undefined): { x: number; y: number }[] {
  return layout?.vertices ?? [];
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
