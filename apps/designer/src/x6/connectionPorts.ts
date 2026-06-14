import type { Graph, Node } from "@antv/x6";
import type { Story, StoryEdge, StoryNode } from "@/core/model/types";
import { isJumpNode, isSceneNode, isStartNode } from "@/core/model/nodeTypes";
import {
  FREE_IN_PORT,
  FREE_OUT_PORT,
  isFreePort,
  isOutPort,
  sourcePortId,
} from "./constants";

function ensureInPort(node: Node): void {
  if (!node.hasPort(FREE_IN_PORT)) {
    node.addPort({ id: FREE_IN_PORT, group: "in" });
  }
}

function removeInPort(node: Node): void {
  if (node.hasPort(FREE_IN_PORT)) {
    node.removePort(FREE_IN_PORT);
  }
}

function isFreeOutPortInUse(node: Node, graph: Graph): boolean {
  return graph.getEdges().some(
    (edge) =>
      edge.getSourceCellId() === node.id && edge.getSourcePortId() === FREE_OUT_PORT
  );
}

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

function removeAllOutPorts(node: Node): void {
  for (const port of [...node.getPorts()]) {
    const portId = port.id;
    if (portId && isOutPort(portId)) {
      node.removePort(portId);
    }
  }
}

function getConnectedOutPortIds(nodeId: string, story: Story): string[] {
  const connectedOutPortIds: string[] = [];
  for (const edge of story.edges) {
    if (edge.sourceNodeId !== nodeId) continue;
    const outId = edge.sourcePortId ?? sourcePortId(edge.id);
    if (!connectedOutPortIds.includes(outId)) {
      connectedOutPortIds.push(outId);
    }
  }
  connectedOutPortIds.sort();
  return connectedOutPortIds;
}

export function syncNodeEdgePorts(
  node: Node,
  domainNode: StoryNode,
  story: Story,
  graph: Graph
): void {
  if (isStartNode(domainNode)) {
    removeInPort(node);
    syncOutPorts(node, getConnectedOutPortIds(node.id, story), graph);
  } else if (isJumpNode(domainNode)) {
    removeAllOutPorts(node);
    ensureInPort(node);
  } else if (isSceneNode(domainNode)) {
    ensureInPort(node);
    syncOutPorts(node, getConnectedOutPortIds(node.id, story), graph);
  }

  for (const port of [...node.getPorts()]) {
    const portId = port.id;
    if (!portId || isFreePort(portId) || isOutPort(portId) || portId === FREE_IN_PORT) {
      continue;
    }
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
