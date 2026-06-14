import type { Options, ValidateConnectionArgs } from "@antv/x6";
import { Shape } from "@antv/x6";
import { selectActiveStory, useProjectStore } from "@/store/projectStore";
import {
  STORY_EDGE_SHAPE,
  isEndNodeId,
  isOutPort,
  isSyntheticEndEdgeId,
  magnetPortId,
} from "./constants";
import { validateStoryConnection } from "./validateStoryConnection";
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
        const resolvedTargetPort =
          targetPort ?? (targetMagnet ? magnetPortId(targetMagnet) : null);

        return validateStoryConnection({
          sourceNodeId: sourceCell.id,
          targetNodeId: targetCell?.id ?? null,
          sourcePort: resolvedSourcePort,
          targetPort: resolvedTargetPort,
          lookupNode: getDomainNode,
        });
      },
    },
    interacting(cellView) {
      const cell = cellView.cell;
      if (cell.isNode() && isEndNodeId(cell.id)) {
        return { nodeMovable: false };
      }
      if (cell.isEdge() && isSyntheticEndEdgeId(cell.id)) {
        return {
          edgeMovable: false,
          vertexMovable: false,
          vertexAddable: false,
          vertexDeletable: false,
          magnetConnectable: false,
        };
      }
      return {
        magnetConnectable: true,
        nodeMovable: true,
        vertexMovable: true,
        vertexAddable: true,
        vertexDeletable: true,
      };
    },
  };
}
