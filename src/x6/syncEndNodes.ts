import type { Graph, Node } from "@antv/x6";
import type { Story } from "@/core/model/types";
import {
  getEndEdgeRouter,
  getEndEdgeVertices,
  getEndNodeLayout,
  getTerminalSceneIds,
  resolveEndNodePosition,
} from "@/core/model/endNodeLayout";
import {
  applyEndCircleStyle,
  CIRCLE_NODE_SIZE,
  SYNTHETIC_END_EDGE_STROKE,
} from "./storyNodeShapes";
import {
  END_NODE_ID_PREFIX,
  END_NODE_SHAPE,
  FREE_IN_PORT,
  FREE_OUT_PORT,
  STORY_EDGE_SHAPE,
  endNodeIdForScene,
  isEndNodeId,
} from "./constants";
import { storyEdgeConnector } from "./edgeConfig";
import { applyGraphNodePosition } from "./syncNodes";

export { getTerminalSceneIds };

function syncSyntheticEndEdge(
  graph: Graph,
  sceneId: string,
  endId: string,
  story: Story
): void {
  const syntheticEdgeId = `${END_NODE_ID_PREFIX}edge:${sceneId}`;
  const layout = getEndNodeLayout(story, sceneId);
  const router = getEndEdgeRouter(layout);
  const vertices = getEndEdgeVertices(layout);
  const existingEdge = graph.getCellById(syntheticEdgeId);

  if (!existingEdge) {
    graph.addEdge({
      id: syntheticEdgeId,
      shape: STORY_EDGE_SHAPE,
      source: { cell: sceneId, port: FREE_OUT_PORT },
      target: { cell: endId, port: FREE_IN_PORT },
      router,
      connector: storyEdgeConnector,
      vertices,
      attrs: {
        line: {
          stroke: SYNTHETIC_END_EDGE_STROKE,
          strokeWidth: 1.5,
          strokeDasharray: "6 4",
          targetMarker: { name: "block", width: 8, height: 5 },
        },
      },
      zIndex: -1,
    });
    return;
  }

  if (!existingEdge.isEdge()) return;

  existingEdge.setRouter(router);
  existingEdge.setConnector(storyEdgeConnector);
  existingEdge.setVertices(vertices, { silent: true });
  existingEdge.setSource({ cell: sceneId, port: FREE_OUT_PORT });
  existingEdge.setTarget({ cell: endId, port: FREE_IN_PORT });
  existingEdge.attr("line/stroke", SYNTHETIC_END_EDGE_STROKE);
}

function addEndGraphNode(graph: Graph, endId: string, position: { x: number; y: number }): void {
  graph.addNode({
    id: endId,
    shape: END_NODE_SHAPE,
    width: CIRCLE_NODE_SIZE,
    height: CIRCLE_NODE_SIZE,
    x: position.x,
    y: position.y,
    label: "End",
    data: { virtual: true },
  });
}

function ensureEndGraphNode(
  graph: Graph,
  endId: string,
  position: { x: number; y: number }
): Node | null {
  let endCell = graph.getCellById(endId);
  if (!endCell?.isNode()) {
    addEndGraphNode(graph, endId, position);
    endCell = graph.getCellById(endId);
  } else {
    const endNode = endCell as Node;
    if (endNode.shape !== END_NODE_SHAPE) {
      graph.removeNode(endId);
      addEndGraphNode(graph, endId, position);
      endCell = graph.getCellById(endId);
    } else {
      applyGraphNodePosition(endNode, position);
    }
  }
  return endCell?.isNode() ? (endCell as Node) : null;
}

/** Keep a terminal scene's End node (and synthetic edge) aligned while the scene moves. */
export function repositionEndNodeForScene(
  graph: Graph,
  story: Story,
  sceneId: string
): void {
  if (!getTerminalSceneIds(story).includes(sceneId)) return;

  const sceneCell = graph.getCellById(sceneId);
  if (!sceneCell?.isNode()) return;

  const sceneNode = sceneCell as Node;
  const endId = endNodeIdForScene(sceneId);
  const endPosition = resolveEndNodePosition(
    story,
    sceneId,
    sceneNode.getPosition(),
    sceneNode.getSize()
  );

  const endNode = ensureEndGraphNode(graph, endId, endPosition);
  if (!endNode) return;

  syncSyntheticEndEdge(graph, sceneId, endId, story);
}

export function syncEndNodes(graph: Graph, story: Story): void {
  const terminalSceneIds = new Set(getTerminalSceneIds(story));
  const expectedEndIds = new Set(
    [...terminalSceneIds].map((sceneId) => endNodeIdForScene(sceneId))
  );

  for (const node of graph.getNodes()) {
    if (isEndNodeId(node.id) && !expectedEndIds.has(node.id)) {
      graph.removeNode(node.id);
    }
  }

  for (const sceneId of terminalSceneIds) {
    repositionEndNodeForScene(graph, story, sceneId);

    const endId = endNodeIdForScene(sceneId);
    const endNode = graph.getCellById(endId);
    if (!endNode?.isNode()) continue;

    applyEndCircleStyle(endNode as Node);

    if (!endNode.hasPort(FREE_IN_PORT)) {
      endNode.addPort({ id: FREE_IN_PORT, group: "in" });
    }
  }

  for (const edge of graph.getEdges()) {
    if (edge.id.startsWith(`${END_NODE_ID_PREFIX}edge:`)) {
      const sceneId = edge.id.slice(`${END_NODE_ID_PREFIX}edge:`.length);
      if (!terminalSceneIds.has(sceneId)) {
        graph.removeEdge(edge.id);
      }
    }
  }
}
