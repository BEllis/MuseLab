import type { Graph } from "@antv/x6";
import type { StoryNode } from "@/core/model/types";
import { isSyntheticEndEdgeId } from "./constants";
import { isSceneNode, isStartNode } from "@/core/model/nodeTypes";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  findNonOverlappingPosition,
  type NodeWithPosition,
} from "@/utils/nodeOverlap";

export type ConnectionDropOnBlank = {
  sourceId: string;
  sourcePort: string | null | undefined;
  clientX: number;
  clientY: number;
  graphPoint: { x: number; y: number };
};

export type ConnectionDropAction = "clone-scene" | "new-scene" | "jump" | "cancel";

export function graphPointFromEdgeDrop(
  graph: Graph,
  edgeTarget: { x?: number; y?: number } | null | undefined,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  if (edgeTarget && typeof edgeTarget.x === "number" && typeof edgeTarget.y === "number") {
    return { x: edgeTarget.x, y: edgeTarget.y };
  }
  return graph.clientToLocal(clientX, clientY);
}

export function viewportCenterGraphPoint(
  graph: Graph,
  container: HTMLElement
): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  return graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

export function proposedNodePositionAtPoint(
  graphPoint: { x: number; y: number },
  existingNodes: NodeWithPosition[]
): { x: number; y: number } {
  const raw = {
    x: graphPoint.x - DEFAULT_NODE_WIDTH / 2,
    y: graphPoint.y - DEFAULT_NODE_HEIGHT / 2,
  };
  return findNonOverlappingPosition("__draft__", raw, existingNodes);
}

export function proposedNodePositionAtViewportCenter(
  graph: Graph,
  container: HTMLElement,
  existingNodes: NodeWithPosition[]
): { x: number; y: number } {
  return proposedNodePositionAtPoint(viewportCenterGraphPoint(graph, container), existingNodes);
}

export function canSourceStartConnection(source: StoryNode | undefined): source is StoryNode {
  return source != null && (isStartNode(source) || isSceneNode(source));
}

export function isBlankTargetEdge(targetCellId: string | null | undefined): boolean {
  return !targetCellId;
}

export function isPreviewConnectionEdge(
  edgeId: string,
  projectEdgeIds: ReadonlySet<string>
): boolean {
  if (isSyntheticEndEdgeId(edgeId)) return false;
  return !projectEdgeIds.has(edgeId);
}

export function connectionDropMenuOptions(source: StoryNode | undefined): ConnectionDropAction[] {
  if (!canSourceStartConnection(source)) {
    return ["cancel"];
  }
  const options: ConnectionDropAction[] = [];
  if (isSceneNode(source)) {
    options.push("clone-scene");
  }
  options.push("new-scene", "jump", "cancel");
  return options;
}

export const CONNECTION_DROP_LABELS: Record<ConnectionDropAction, string> = {
  "clone-scene": "Clone Scene",
  "new-scene": "Create New Scene",
  jump: "Create Jump To",
  cancel: "Cancel",
};
