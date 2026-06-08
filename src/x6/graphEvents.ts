import type { Graph } from "@antv/x6";
import type { MutableRefObject } from "react";
import { selectActiveStory, useProjectStore } from "@/store/projectStore";
import {
  findNonOverlappingPosition,
  type NodeWithPosition,
} from "@/utils/nodeOverlap";
import { verticesFromGraphEdge } from "./edgeConfig";
import { purgeDanglingEdges, purgeFreeOutPreviews } from "./syncEdges";
import { syncProjectToGraph } from "./syncProjectToGraph";

type PendingConnection = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourcePort: string | null | undefined;
};

const pendingConnectionEdgeIds = new Set<string>();

function getActiveGraphContext() {
  const state = useProjectStore.getState();
  const story = selectActiveStory(state.project, state.activeStoryId);
  return { state, story };
}

function cleanupDanglingEdges(graph: Graph): void {
  const { story } = getActiveGraphContext();
  purgeDanglingEdges(graph, story, {
    retainEdgeIds: pendingConnectionEdgeIds,
  });
  purgeFreeOutPreviews(graph, story);
}

function finalizeConnection(
  graph: Graph,
  isSyncingRef: MutableRefObject<boolean>,
  connection: PendingConnection
): void {
  if (isSyncingRef.current) return;

  const { state, story } = getActiveGraphContext();
  if (!story.edges.some((stored) => stored.id === connection.edgeId)) {
    state.addEdge(connection.sourceId, connection.targetId, {
      id: connection.edgeId,
      sourcePortId: connection.sourcePort,
    });
  }

  const nextState = useProjectStore.getState();
  const nextStory = selectActiveStory(nextState.project, nextState.activeStoryId);
  syncProjectToGraph(
    graph,
    nextState.project,
    nextStory,
    nextState.activeStoryId,
    nextState.promptsByLocale,
    new Set(nextState.selectedNodeIds),
    new Set(nextState.selectedEdgeIds),
    new Set(nextState.highlightedRootNodeIds),
    isSyncingRef
  );

  purgeDanglingEdges(graph, nextStory);
  purgeFreeOutPreviews(graph, nextStory);
}

function scheduleConnectionFinalize(
  graph: Graph,
  isSyncingRef: MutableRefObject<boolean>,
  connection: PendingConnection
): void {
  pendingConnectionEdgeIds.add(connection.edgeId);

  queueMicrotask(() => {
    try {
      finalizeConnection(graph, isSyncingRef, connection);
    } finally {
      pendingConnectionEdgeIds.delete(connection.edgeId);
    }
  });
}

export function bindGraphEvents(
  graph: Graph,
  isSyncingRef: MutableRefObject<boolean>
): void {
  graph.on("edge:connected", ({ edge, isNew }) => {
    if (isSyncingRef.current || !isNew) return;

    const edgeId = edge.id;
    const sourceId = edge.getSourceCellId();
    const targetId = edge.getTargetCellId();
    const sourcePort = edge.getSourcePortId();

    if (!edgeId || !sourceId || !targetId || sourceId === targetId) {
      graph.removeEdge(edge.id);
      queueMicrotask(() => cleanupDanglingEdges(graph));
      return;
    }

    scheduleConnectionFinalize(graph, isSyncingRef, {
      edgeId,
      sourceId,
      targetId,
      sourcePort,
    });
  });

  graph.on("edge:change:vertices", ({ edge, options }) => {
    if (isSyncingRef.current || options?.silent) return;

    const vertices = verticesFromGraphEdge(edge);
    const manualRoute = vertices.length > 0;
    useProjectStore.getState().updateEdge(
      edge.id,
      {
        vertices: manualRoute ? vertices : undefined,
        manualRoute: manualRoute || undefined,
      },
      { mergeKey: `edge-vertices:${edge.id}` }
    );
  });

  graph.on("blank:mouseup", () => {
    if (isSyncingRef.current) return;
    cleanupDanglingEdges(graph);
    useProjectStore.getState().flushHistoryCoalesce();
  });

  graph.on("node:moved", ({ node }) => {
    if (isSyncingRef.current) return;

    const position = node.getPosition();
    const { story } = getActiveGraphContext();
    const allNodes: NodeWithPosition[] = story.nodes.map((nn) => ({
      id: nn.id,
      position: nn.id === node.id ? position : (nn.position ?? { x: 0, y: 0 }),
    }));
    const resolved = findNonOverlappingPosition(node.id, position, allNodes);
    useProjectStore.getState().updateNodePosition(node.id, resolved);
  });

  graph.on("selection:changed", ({ selected }) => {
    const nodeIds = selected.filter((cell) => cell.isNode()).map((cell) => cell.id);
    const edgeIds = selected.filter((cell) => cell.isEdge()).map((cell) => cell.id);
    useProjectStore.getState().setSelection(nodeIds, edgeIds);
  });
}

export function bindGraphKeyboard(
  graph: Graph,
  keyboard: { bindKey: (keys: string | string[], callback: () => void) => void }
): void {
  keyboard.bindKey(["backspace", "delete"], () => {
    const state = useProjectStore.getState();
    const { selectedNodeIds, selectedEdgeIds } = state;
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;

    state.beginHistoryTransaction();
    try {
      for (const edgeId of selectedEdgeIds) {
        useProjectStore.getState().removeEdge(edgeId);
      }
      for (const nodeId of selectedNodeIds) {
        useProjectStore.getState().removeNode(nodeId);
      }
    } finally {
      useProjectStore.getState().commitHistoryTransaction();
    }
    state.clearSelection();
    graph.cleanSelection();
  });
}
