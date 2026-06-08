import type { Graph } from "@antv/x6";
import type { Project, Story } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
import {
  purgeDanglingEdges,
  purgeFreeOutPreviews,
  removeStaleEdges,
  syncProjectEdge,
} from "./syncEdges";
import { removeStaleNodes, syncProjectNode } from "./syncNodes";
import { syncEndNodes } from "./syncEndNodes";

export type SyncGuard = { current: boolean };

export type SyncProjectToGraphOptions = {
  /** Drop all graph cells and rebuild from the project model. */
  fullRefresh?: boolean;
};

export function syncProjectToGraph(
  graph: Graph,
  project: Project,
  story: Story,
  storyId: string,
  promptsByLocale: PromptsByLocale,
  selectedNodeIds: ReadonlySet<string>,
  selectedEdgeIds: ReadonlySet<string>,
  highlightedRootNodeIds: ReadonlySet<string>,
  guard?: SyncGuard,
  options?: SyncProjectToGraphOptions
): void {
  if (guard) guard.current = true;

  try {
    graph.batchUpdate("sync-project", () => {
      if (options?.fullRefresh) {
        graph.clearCells();
      }

      const projectNodeIds = new Set(story.nodes.map((node) => node.id));
      const projectEdgeIds = new Set(story.edges.map((edge) => edge.id));

      purgeDanglingEdges(graph, story);
      removeStaleNodes(graph, projectNodeIds);
      removeStaleEdges(graph, projectEdgeIds);

      for (const projectNode of story.nodes) {
        syncProjectNode(
          graph,
          projectNode,
          selectedNodeIds,
          highlightedRootNodeIds,
          project,
          story,
          storyId,
          promptsByLocale
        );
      }

      for (const projectEdge of story.edges) {
        syncProjectEdge(
          graph,
          projectEdge,
          selectedEdgeIds.has(projectEdge.id),
          project,
          storyId,
          promptsByLocale
        );
      }

      syncEndNodes(graph, story);

      purgeDanglingEdges(graph, story);
      purgeFreeOutPreviews(graph, story);
    });
  } finally {
    if (guard) guard.current = false;
  }
}
