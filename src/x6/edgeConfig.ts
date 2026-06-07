import type { Edge } from "@antv/x6";
import type { StoryEdge } from "@/core/model/types";
import {
  DEFAULT_EDGE_STROKE,
  DEFAULT_EDGE_STROKE_WIDTH,
  SELECTION_COLOR,
  SELECTED_EDGE_STROKE_WIDTH,
} from "./selectionStyle";

/** Auto-routing for new edges: orthogonal path that avoids other nodes. */
export const autoEdgeRouter = {
  name: "manhattan" as const,
  args: {
    padding: 12,
    step: 10,
    startDirections: ["right"],
    endDirections: ["left"],
    excludeTerminals: ["source", "target"] as ("source" | "target")[],
  },
};

/** User-shaped edges follow stored vertices without re-routing. */
export const manualEdgeRouter = {
  name: "normal" as const,
};

export const storyEdgeConnector = {
  name: "rounded" as const,
  args: { radius: 8 },
};

export const selectedEdgeTools = [
  {
    name: "vertices",
    args: {
      addable: true,
      removable: true,
      snapRadius: 20,
    },
  },
  {
    name: "segments",
    args: {
      snapRadius: 20,
      threshold: 16,
    },
  },
];

export function isManualRoute(edge: StoryEdge): boolean {
  return edge.manualRoute === true || (edge.vertices?.length ?? 0) > 0;
}

export function getStoryEdgeRouter(edge: StoryEdge) {
  return isManualRoute(edge) ? manualEdgeRouter : autoEdgeRouter;
}

export function getStoryEdgeVertices(edge: StoryEdge) {
  return edge.vertices ?? [];
}

export function verticesFromGraphEdge(edge: Edge): { x: number; y: number }[] {
  return edge.getVertices().map((point) => ({ x: point.x, y: point.y }));
}

export function applyEdgeTools(edge: Edge, selected: boolean): void {
  if (selected) {
    edge.setTools([...selectedEdgeTools]);
  } else {
    edge.removeTools();
  }
}

export function applyEdgeSelectionStyle(edge: Edge, selected: boolean): void {
  edge.attr("line/stroke", selected ? SELECTION_COLOR : DEFAULT_EDGE_STROKE);
  edge.attr("line/strokeWidth", selected ? SELECTED_EDGE_STROKE_WIDTH : DEFAULT_EDGE_STROKE_WIDTH);
  edge.setZIndex(selected ? 10 : 0);
  applyEdgeTools(edge, selected);
}
