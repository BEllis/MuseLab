import type { Options, ValidateConnectionArgs } from "@antv/x6";
import { Shape } from "@antv/x6";
import { selectActiveStory, useProjectStore } from "@/store/projectStore";
import { isJumpNode, isSceneNode, isStartNode } from "@/core/model/nodeTypes";
import {
  FREE_IN_PORT,
  STORY_EDGE_SHAPE,
  isEndNodeId,
  isOutPort,
  magnetPortId,
} from "./constants";
import { autoEdgeRouter, storyEdgeConnector } from "./edgeConfig";

function getDomainNode(nodeId: string) {
  const state = useProjectStore.getState();
  const story = selectActiveStory(state.project, state.activeStoryId);
  return story.nodes.find((node) => node.id === nodeId) ?? null;
}

export function createGraphOptions(container: HTMLElement): Options {
  return {
    container,
    autoResize: true,
    panning: true,
    mousewheel: {
      enabled: true,
      modifiers: [],
      minScale: 0.2,
      maxScale: 2,
    },
    background: { color: "#f8f8f8" },
    grid: {
      visible: true,
      type: "dot",
      args: { color: "#ddd", thickness: 1 },
    },
    connecting: {
      snap: { radius: 250 },
      allowBlank: true,
      allowLoop: false,
      allowNode: false,
      allowEdge: false,
      allowPort: true,
      allowMulti: true,
      highlight: true,
      router: autoEdgeRouter,
      connector: storyEdgeConnector,
      createEdge() {
        return new Shape.Edge({
          shape: STORY_EDGE_SHAPE,
          router: autoEdgeRouter,
          connector: storyEdgeConnector,
        });
      },
      validateMagnet({ magnet }) {
        const portId = magnetPortId(magnet);
        return isOutPort(portId);
      },
      validateConnection({
        sourceCell,
        targetCell,
        sourcePort,
        targetPort,
        sourceMagnet,
        targetMagnet,
      }: ValidateConnectionArgs) {
        if (!sourceCell) return false;

        const resolvedSourcePort =
          sourcePort ?? (sourceMagnet ? magnetPortId(sourceMagnet) : null);
        if (!isOutPort(resolvedSourcePort)) return false;

        const sourceNode = getDomainNode(sourceCell.id);
        if (!sourceNode || (!isStartNode(sourceNode) && !isSceneNode(sourceNode))) {
          return false;
        }

        if (!targetCell) return true;

        if (sourceCell.id === targetCell.id) return false;
        if (isEndNodeId(sourceCell.id) || isEndNodeId(targetCell.id)) return false;

        const resolvedTargetPort =
          targetPort ?? (targetMagnet ? magnetPortId(targetMagnet) : null);

        if (resolvedTargetPort !== FREE_IN_PORT) return false;

        const targetNode = getDomainNode(targetCell.id);
        if (!targetNode) return false;

        if (!isSceneNode(targetNode) && !isJumpNode(targetNode)) return false;

        return true;
      },
    },
    interacting: {
      magnetConnectable: true,
      nodeMovable: true,
      vertexMovable: true,
      vertexAddable: true,
      vertexDeletable: true,
    },
  };
}
