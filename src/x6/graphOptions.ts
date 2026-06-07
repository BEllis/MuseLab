import type { Options, ValidateConnectionArgs } from "@antv/x6";
import { Shape } from "@antv/x6";
import {
  FREE_IN_PORT,
  STORY_EDGE_SHAPE,
  isOutPort,
  magnetPortId,
} from "./constants";
import { autoEdgeRouter, storyEdgeConnector } from "./edgeConfig";

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
      allowBlank: false,
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
        if (!sourceCell || !targetCell) return false;
        if (sourceCell.id === targetCell.id) return false;

        const resolvedSourcePort =
          sourcePort ?? (sourceMagnet ? magnetPortId(sourceMagnet) : null);
        const resolvedTargetPort =
          targetPort ?? (targetMagnet ? magnetPortId(targetMagnet) : null);

        if (!isOutPort(resolvedSourcePort)) return false;
        if (resolvedTargetPort !== FREE_IN_PORT) return false;
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
