import type { Graph } from "@antv/x6";
import type { Project } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
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
  promptsByLocale: PromptsByLocale,
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
          project,
          promptsByLocale
        );
      }

      for (const projectEdge of project.edges) {
        syncProjectEdge(
          graph,
          projectEdge,
          selectedEdgeIds.has(projectEdge.id),
          project,
          promptsByLocale
        );
      }

      purgeDanglingEdges(graph, project);
      purgeFreeOutPreviews(graph, project);
    });
  } finally {
    if (guard) guard.current = false;
  }
}
