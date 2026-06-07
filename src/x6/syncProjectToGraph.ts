import type { Graph } from "@antv/x6";
import type { Project } from "@/core/model/types";
import {
  purgeDanglingEdges,
  purgeFreeOutPreviews,
  removeStaleEdges,
  syncProjectEdge,
} from "./syncEdges";
import { removeStaleNodes, syncProjectNode } from "./syncNodes";

export type SyncGuard = { current: boolean };

export function syncProjectToGraph(
  graph: Graph,
  project: Project,
  selectedNodeIds: ReadonlySet<string>,
  selectedEdgeIds: ReadonlySet<string>,
  highlightedRootNodeIds: ReadonlySet<string>,
  guard?: SyncGuard
): void {
  if (guard) guard.current = true;

  try {
    graph.batchUpdate("sync-project", () => {
      const projectNodeIds = new Set(project.nodes.map((node) => node.id));
      const projectEdgeIds = new Set(project.edges.map((edge) => edge.id));

      purgeDanglingEdges(graph, project);
      removeStaleNodes(graph, projectNodeIds);
      removeStaleEdges(graph, projectEdgeIds);

      for (const projectNode of project.nodes) {
        syncProjectNode(
          graph,
          projectNode,
          selectedNodeIds,
          highlightedRootNodeIds,
          project
        );
      }

      for (const projectEdge of project.edges) {
        syncProjectEdge(graph, projectEdge, selectedEdgeIds.has(projectEdge.id));
      }

      purgeDanglingEdges(graph, project);
      purgeFreeOutPreviews(graph, project);
    });
  } finally {
    if (guard) guard.current = false;
  }
}
