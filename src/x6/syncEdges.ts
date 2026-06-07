import type { Edge, Graph } from "@antv/x6";
import type { Project, StoryEdge } from "@/core/model/types";
import { buildEdgeSourceTerminal, buildEdgeTargetTerminal } from "./connectionPorts";
import { FREE_OUT_PORT, STORY_EDGE_SHAPE } from "./constants";
import {
  applyEdgeSelectionStyle,
  getStoryEdgeRouter,
  getStoryEdgeVertices,
  storyEdgeConnector,
} from "./edgeConfig";

function edgeConnectionKey(
  sourceId: string,
  sourcePort: string | null | undefined,
  targetId: string,
  targetPort: string | null | undefined
): string {
  return `${sourceId}|${sourcePort ?? ""}|${targetId}|${targetPort ?? ""}`;
}

function hasValidTerminals(edge: Edge): boolean {
  return Boolean(edge.getSourceCellId() && edge.getTargetCellId());
}

function applyEdgeAttrs(edge: Edge, projectEdge: StoryEdge, selected: boolean): void {
  const router = getStoryEdgeRouter(projectEdge);
  const vertices = getStoryEdgeVertices(projectEdge);
  const labels = projectEdge.optionText ? [projectEdge.optionText] : [];
  const source = buildEdgeSourceTerminal(projectEdge);
  const target = buildEdgeTargetTerminal(projectEdge);

  edge.setRouter(router);
  edge.setConnector(storyEdgeConnector);
  edge.setVertices(vertices);
  edge.setSource(source);
  edge.setTarget(target);
  edge.setLabels(labels);
  applyEdgeSelectionStyle(edge, selected);
}

export function syncProjectEdge(
  graph: Graph,
  projectEdge: StoryEdge,
  selected: boolean
): void {
  const existing = graph.getCellById(projectEdge.id);

  if (existing?.isEdge()) {
    applyEdgeAttrs(existing, projectEdge, selected);
    return;
  }

  graph.addEdge({
    id: projectEdge.id,
    shape: STORY_EDGE_SHAPE,
    source: buildEdgeSourceTerminal(projectEdge),
    target: buildEdgeTargetTerminal(projectEdge),
    router: getStoryEdgeRouter(projectEdge),
    connector: storyEdgeConnector,
    vertices: getStoryEdgeVertices(projectEdge),
    labels: projectEdge.optionText ? [projectEdge.optionText] : [],
  });

  const created = graph.getCellById(projectEdge.id);
  if (created?.isEdge()) {
    applyEdgeSelectionStyle(created, selected);
  }
}

export type PurgeDanglingEdgesOptions = {
  /** Graph edge ids to keep even if not yet in the project model. */
  retainEdgeIds?: ReadonlySet<string>;
};

/** Remove preview edges and any graph edge not backed by the project model. */
export function purgeDanglingEdges(
  graph: Graph,
  project: Project,
  options?: PurgeDanglingEdgesOptions
): void {
  const projectEdgeIds = new Set(project.edges.map((edge) => edge.id));
  const retainEdgeIds = options?.retainEdgeIds;
  const canonicalIds = new Map<string, string>();

  for (const projectEdge of project.edges) {
    const key = edgeConnectionKey(
      projectEdge.sourceNodeId,
      projectEdge.sourcePortId,
      projectEdge.targetNodeId,
      projectEdge.targetPortId
    );
    canonicalIds.set(key, projectEdge.id);
  }

  for (const cell of [...graph.getCells()]) {
    if (!cell.isEdge()) continue;

    const edge = cell as Edge;
    if (retainEdgeIds?.has(edge.id)) continue;

    if (!hasValidTerminals(edge) || !projectEdgeIds.has(edge.id)) {
      graph.removeCell(edge.id);
      continue;
    }

    const key = edgeConnectionKey(
      edge.getSourceCellId()!,
      edge.getSourcePortId(),
      edge.getTargetCellId()!,
      edge.getTargetPortId()
    );
    const canonicalId = canonicalIds.get(key);
    if (canonicalId && edge.id !== canonicalId) {
      graph.removeCell(edge.id);
    }
  }
}

export function removeStaleEdges(graph: Graph, projectEdgeIds: ReadonlySet<string>): void {
  for (const edge of [...graph.getEdges()]) {
    if (!projectEdgeIds.has(edge.id)) {
      graph.removeEdge(edge.id);
    }
  }
}

/** Drop cancelled drag previews still attached to the free out port. */
export function purgeFreeOutPreviews(graph: Graph, project: Project): void {
  const projectEdgeIds = new Set(project.edges.map((edge) => edge.id));

  for (const edge of [...graph.getEdges()]) {
    if (edge.getSourcePortId() !== FREE_OUT_PORT) continue;
    if (projectEdgeIds.has(edge.id)) continue;
    graph.removeEdge(edge.id);
  }
}
