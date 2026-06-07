import type { Graph, Node } from "@antv/x6";
import type { Project } from "@/core/model/types";
import { syncNodeEdgePorts } from "./connectionPorts";
import { STORY_NODE_SHAPE } from "./constants";
import { applyNodeBoundaryTool } from "./nodeConfig";

function buildNodeData(
  node: Project["nodes"][number],
  selectedNodeIds: ReadonlySet<string>,
  highlightedRootNodeIds: ReadonlySet<string>
) {
  return {
    label: node.label,
    preview: node.textTemplate.slice(0, 60) || "(no text)",
    selected: selectedNodeIds.has(node.id),
    invalidRoot: highlightedRootNodeIds.has(node.id),
    backdropId: node.backdropId,
  };
}

export function syncProjectNode(
  graph: Graph,
  projectNode: Project["nodes"][number],
  selectedNodeIds: ReadonlySet<string>,
  highlightedRootNodeIds: ReadonlySet<string>,
  project: Project
): void {
  const data = buildNodeData(projectNode, selectedNodeIds, highlightedRootNodeIds);
  const existing = graph.getCellById(projectNode.id);

  if (existing?.isNode()) {
    const node = existing as Node;
    syncNodeEdgePorts(node, project, graph);
    const pos = node.getPosition();
    if (pos.x !== projectNode.position.x || pos.y !== projectNode.position.y) {
      node.setPosition(projectNode.position, { silent: true });
    }
    node.setData(data, { silent: true });
    applyNodeBoundaryTool(node, selectedNodeIds.has(projectNode.id));
    return;
  }

  graph.addNode({
    id: projectNode.id,
    shape: STORY_NODE_SHAPE,
    x: projectNode.position.x,
    y: projectNode.position.y,
    data,
  });

  const created = graph.getCellById(projectNode.id);
  if (created?.isNode()) {
    syncNodeEdgePorts(created, project, graph);
    applyNodeBoundaryTool(created, selectedNodeIds.has(projectNode.id));
  }
}

export function removeStaleNodes(graph: Graph, projectNodeIds: ReadonlySet<string>): void {
  for (const node of graph.getNodes()) {
    if (!projectNodeIds.has(node.id)) {
      graph.removeNode(node.id);
    }
  }
}
