import type { Graph } from "@antv/x6";
import type { MutableRefObject } from "react";
import { useProjectStore } from "@/store/projectStore";
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

function cleanupDanglingEdges(graph: Graph): void {
  purgeDanglingEdges(graph, useProjectStore.getState().project, {
    retainEdgeIds: pendingConnectionEdgeIds,
  });
  purgeFreeOutPreviews(graph, useProjectStore.getState().project);
}

function finalizeConnection(
  graph: Graph,
  isSyncingRef: MutableRefObject<boolean>,
  connection: PendingConnection
): void {
  if (isSyncingRef.current) return;

  const state = useProjectStore.getState();
  if (!state.project.edges.some((stored) => stored.id === connection.edgeId)) {
    state.addEdge(connection.sourceId, connection.targetId, {
      id: connection.edgeId,
      sourcePortId: connection.sourcePort,
    });
  }

  const nextState = useProjectStore.getState();
  syncProjectToGraph(
    graph,
    nextState.project,
    nextState.promptsByLocale,
    new Set(nextState.selectedNodeIds),
    new Set(nextState.selectedEdgeIds),
    new Set(nextState.highlightedRootNodeIds),
    isSyncingRef
  );

  purgeDanglingEdges(graph, nextState.project);
  purgeFreeOutPreviews(graph, nextState.project);
}

function scheduleConnectionFinalize(
  graph: Graph,
  isSyncingRef: MutableRefObject<boolean>,
  connection: PendingConnection
): void {
  pendingConnectionEdgeIds.add(connection.edgeId);

  // edge:connected fires before X6's add-edge batch ends; defer until after
  // stopBatch so we keep the connected edge and can retarget it to out-{id}.
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
    const projectState = useProjectStore.getState().project;
    const allNodes: NodeWithPosition[] = projectState.nodes.map((nn) => ({
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
