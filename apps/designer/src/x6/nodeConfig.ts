import type { Graph, Node } from "@antv/x6";
import { SELECTION_COLOR } from "./selectionStyle";

/** Encirclement box for selected nodes (X6 boundary tool). */
export const selectedNodeBoundaryTool = {
  name: "boundary" as const,
  args: {
    padding: 6,
    attrs: {
      fill: SELECTION_COLOR,
      stroke: SELECTION_COLOR,
      "stroke-width": 2,
      "fill-opacity": 0.08,
      "pointer-events": "none",
    },
  },
};

export function applyNodeBoundaryTool(node: Node, selected: boolean): void {
  if (selected) {
    node.setTools([selectedNodeBoundaryTool]);
  } else {
    node.removeTools();
  }
}

export function syncNodeBoundaryTools(
  graph: Graph,
  selectedNodeIds: ReadonlySet<string>
): void {
  for (const node of graph.getNodes()) {
    applyNodeBoundaryTool(node, selectedNodeIds.has(node.id));
  }
}
