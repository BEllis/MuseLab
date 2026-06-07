import type { Graph, Node } from "@antv/x6";
import type { Project, StoryEdge } from "@/core/model/types";
import {
  FREE_IN_PORT,
  FREE_OUT_PORT,
  isFreePort,
  isOutPort,
  sourcePortId,
} from "./constants";

function ensureSingleInPort(node: Node): void {
  if (!node.hasPort(FREE_IN_PORT)) {
    node.addPort({ id: FREE_IN_PORT, group: "in" });
  }
}

function isFreeOutPortInUse(node: Node, graph: Graph): boolean {
  return graph.getEdges().some(
    (edge) =>
      edge.getSourceCellId() === node.id && edge.getSourcePortId() === FREE_OUT_PORT
  );
}

/** Keep connected out ports stable; spare free out port only while the node has no links. */
function syncOutPorts(node: Node, connectedOutPortIds: string[], graph: Graph): void {
  for (const portId of connectedOutPortIds) {
    if (!node.hasPort(portId)) {
      node.addPort({ id: portId, group: "out" });
    }
  }

  for (const port of [...node.getPorts()]) {
    const portId = port.id;
    if (
      portId &&
      isOutPort(portId) &&
      portId !== FREE_OUT_PORT &&
      !connectedOutPortIds.includes(portId)
    ) {
      node.removePort(portId);
    }
  }

  const freeOutInUse = isFreeOutPortInUse(node, graph);
  const showFreeOut = connectedOutPortIds.length === 0 || freeOutInUse;

  if (showFreeOut) {
    if (!node.hasPort(FREE_OUT_PORT)) {
      node.addPort({ id: FREE_OUT_PORT, group: "out" });
    } else if (!freeOutInUse) {
      node.removePort(FREE_OUT_PORT);
      node.addPort({ id: FREE_OUT_PORT, group: "out" });
    }
    return;
  }

  if (node.hasPort(FREE_OUT_PORT)) {
    node.removePort(FREE_OUT_PORT);
  }
}

export function syncNodeEdgePorts(node: Node, project: Project, graph: Graph): void {
  const connectedOutPortIds: string[] = [];

  for (const edge of project.edges) {
    if (edge.sourceNodeId !== node.id) continue;
    const outId = edge.sourcePortId ?? sourcePortId(edge.id);
    if (!connectedOutPortIds.includes(outId)) {
      connectedOutPortIds.push(outId);
    }
  }

  connectedOutPortIds.sort();

  ensureSingleInPort(node);
  syncOutPorts(node, connectedOutPortIds, graph);

  for (const port of [...node.getPorts()]) {
    const portId = port.id;
    if (!portId || isFreePort(portId) || isOutPort(portId)) continue;
    node.removePort(portId);
  }
}

export function buildEdgeSourceTerminal(edge: StoryEdge) {
  return {
    cell: edge.sourceNodeId,
    port: edge.sourcePortId ?? sourcePortId(edge.id),
  };
}

export function buildEdgeTargetTerminal(edge: StoryEdge) {
  return {
    cell: edge.targetNodeId,
    port: FREE_IN_PORT,
  };
}
