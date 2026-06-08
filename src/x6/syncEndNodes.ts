import type { Graph, Node } from "@antv/x6";
import type { Story } from "@/core/model/types";
import { isSceneNode } from "@/core/model/nodeTypes";
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH, MIN_NODE_GAP } from "@/utils/nodeOverlap";
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
import { autoEdgeRouter, storyEdgeConnector } from "./edgeConfig";

function sceneHasOutgoingLink(story: Story, sceneId: string): boolean {
  return story.edges.some((edge) => edge.sourceNodeId === sceneId);
}

export function getTerminalSceneIds(story: Story): string[] {
  return story.nodes
    .filter((node) => isSceneNode(node) && !sceneHasOutgoingLink(story, node.id))
    .map((node) => node.id);
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
    const endId = endNodeIdForScene(sceneId);
    const sceneCell = graph.getCellById(sceneId);
    if (!sceneCell?.isNode()) continue;

    const scenePos = sceneCell.getPosition();
    const endPosition = {
      x: scenePos.x + DEFAULT_NODE_WIDTH + MIN_NODE_GAP,
      y: scenePos.y + (DEFAULT_NODE_HEIGHT - CIRCLE_NODE_SIZE) / 2,
    };

    let endCell = graph.getCellById(endId);
    if (!endCell?.isNode()) {
      graph.addNode({
        id: endId,
        shape: END_NODE_SHAPE,
        width: CIRCLE_NODE_SIZE,
        height: CIRCLE_NODE_SIZE,
        x: endPosition.x,
        y: endPosition.y,
        label: "End",
        data: { virtual: true },
      });
      endCell = graph.getCellById(endId);
    } else {
      const endNode = endCell as Node;
      if (endNode.shape !== END_NODE_SHAPE) {
        graph.removeNode(endId);
        graph.addNode({
          id: endId,
          shape: END_NODE_SHAPE,
          width: CIRCLE_NODE_SIZE,
          height: CIRCLE_NODE_SIZE,
          x: endPosition.x,
          y: endPosition.y,
          label: "End",
          data: { virtual: true },
        });
      } else {
        const pos = endNode.getPosition();
        if (pos.x !== endPosition.x || pos.y !== endPosition.y) {
          endNode.setPosition(endPosition, { silent: true });
        }
      }
    }

    const endNode = graph.getCellById(endId);
    if (!endNode?.isNode()) continue;

    applyEndCircleStyle(endNode as Node);

    if (!endNode.hasPort(FREE_IN_PORT)) {
      endNode.addPort({ id: FREE_IN_PORT, group: "in" });
    }

    const syntheticEdgeId = `${END_NODE_ID_PREFIX}edge:${sceneId}`;
    const existingEdge = graph.getCellById(syntheticEdgeId);
    if (!existingEdge) {
      graph.addEdge({
        id: syntheticEdgeId,
        shape: STORY_EDGE_SHAPE,
        source: { cell: sceneId, port: FREE_OUT_PORT },
        target: { cell: endId, port: FREE_IN_PORT },
        router: autoEdgeRouter,
        connector: storyEdgeConnector,
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
    } else if (existingEdge.isEdge()) {
      existingEdge.attr("line/stroke", SYNTHETIC_END_EDGE_STROKE);
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
