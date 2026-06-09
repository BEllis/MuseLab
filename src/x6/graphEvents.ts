import type { Edge, Graph } from "@antv/x6";
import type { MutableRefObject } from "react";
import {
  isProjectHistoryReplayActive,
  selectActiveStory,
  useProjectStore,
} from "@/store/projectStore";
import {
  findNonOverlappingPosition,
  type NodeWithPosition,
} from "@/utils/nodeOverlap";
import {
  graphPointFromEdgeDrop,
  isBlankTargetEdge,
  isPreviewConnectionEdge,
  type ConnectionDropOnBlank,
} from "./connectionDrop";
import { verticesFromGraphEdge } from "./edgeConfig";
import { purgeDanglingEdges, purgeFreeOutPreviews } from "./syncEdges";
import { syncProjectToGraph } from "./syncProjectToGraph";
import {
  isEndNodeId,
  isSyntheticEndEdgeId,
  sceneIdFromEndNodeId,
  sceneIdFromSyntheticEndEdgeId,
} from "./constants";

export type { ConnectionDropOnBlank };

export type GraphEventHandlers = {
  onConnectionDropOnBlank?: (payload: ConnectionDropOnBlank) => void;
};

type PendingConnection = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourcePort: string | null | undefined;
};

type MouseLikeEvent = {
  clientX?: number;
  clientY?: number;
};

const pendingConnectionEdgeIds = new Set<string>();
const handledBlankDropEdgeIds = new Set<string>();

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

function shouldOfferBlankConnectionDrop(
  graph: Graph,
  edge: Edge,
  isNew: boolean
): boolean {
  if (!isNew) return false;
  if (!isBlankTargetEdge(edge.getTargetCellId())) return false;

  const { story } = getActiveGraphContext();
  const projectEdgeIds = new Set(story.edges.map((stored) => stored.id));
  return isPreviewConnectionEdge(edge.id, projectEdgeIds);
}

function offerBlankConnectionDrop(
  graph: Graph,
  edge: Edge,
  e: MouseLikeEvent | undefined,
  handlers: GraphEventHandlers
): boolean {
  const edgeId = edge.id;
  const sourceId = edge.getSourceCellId();
  if (!edgeId || !sourceId || handledBlankDropEdgeIds.has(edgeId)) {
    return false;
  }

  handledBlankDropEdgeIds.add(edgeId);
  queueMicrotask(() => handledBlankDropEdgeIds.delete(edgeId));

  const target = edge.getTarget();
  const graphPoint = graphPointFromEdgeDrop(
    graph,
    target && "x" in target ? target : null,
    e?.clientX ?? 0,
    e?.clientY ?? 0
  );

  if (graph.getCellById(edgeId)) {
    graph.removeEdge(edgeId);
  }
  queueMicrotask(() => cleanupDanglingEdges(graph));

  handlers.onConnectionDropOnBlank?.({
    sourceId,
    sourcePort: edge.getSourcePortId(),
    clientX: e?.clientX ?? 0,
    clientY: e?.clientY ?? 0,
    graphPoint,
  });
  return true;
}

export function bindGraphEvents(
  graph: Graph,
  isSyncingRef: MutableRefObject<boolean>,
  handlers: GraphEventHandlers = {}
): void {
  graph.on("edge:connected", ({ edge, isNew, e, currentCell }) => {
    if (isSyncingRef.current || !isNew) return;

    const edgeId = edge.id;
    const sourceId = edge.getSourceCellId();
    const targetId = edge.getTargetCellId() ?? currentCell?.id;
    const sourcePort = edge.getSourcePortId();

    if (!edgeId || !sourceId) {
      graph.removeEdge(edge.id);
      queueMicrotask(() => cleanupDanglingEdges(graph));
      return;
    }

    if (shouldOfferBlankConnectionDrop(graph, edge, isNew) || (!targetId && !currentCell)) {
      offerBlankConnectionDrop(graph, edge, e, handlers);
      return;
    }

    if (sourceId === targetId) {
      graph.removeEdge(edge.id);
      queueMicrotask(() => cleanupDanglingEdges(graph));
      return;
    }

    scheduleConnectionFinalize(graph, isSyncingRef, {
      edgeId,
      sourceId,
      targetId: targetId!,
      sourcePort,
    });
  });

  // X6 often skips edge:connected for blank point drops because point terminals
  // compare equal without a cell id. Handle those on mouseup instead.
  graph.on("edge:mouseup", ({ edge, e }) => {
    if (isSyncingRef.current) return;
    if (!shouldOfferBlankConnectionDrop(graph, edge, true)) return;
    offerBlankConnectionDrop(graph, edge, e, handlers);
  });

  graph.on("edge:change:vertices", ({ edge, options }) => {
    if (isSyncingRef.current || options?.silent) return;

    if (isSyntheticEndEdgeId(edge.id)) {
      const sceneId = sceneIdFromSyntheticEndEdgeId(edge.id);
      if (!sceneId) return;
      const vertices = verticesFromGraphEdge(edge);
      const manualRoute = vertices.length > 0;
      useProjectStore.getState().updateEndNodeLayout(
        sceneId,
        {
          vertices: manualRoute ? vertices : undefined,
          manualRoute: manualRoute || undefined,
        },
        { mergeKey: `end-node-edge:${sceneId}` }
      );
      return;
    }

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
    if (isSyncingRef.current || isProjectHistoryReplayActive()) return;

    if (isEndNodeId(node.id)) {
      const sceneId = sceneIdFromEndNodeId(node.id);
      if (!sceneId) return;
      const position = node.getPosition();
      useProjectStore.getState().updateEndNodeLayout(sceneId, { position });
      return;
    }

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
    if (isSyncingRef.current || isProjectHistoryReplayActive()) return;

    const nodeIds = selected
      .filter((cell) => cell.isNode() && !isEndNodeId(cell.id))
      .map((cell) => cell.id);
    const edgeIds = selected
      .filter((cell) => cell.isEdge() && !isSyntheticEndEdgeId(cell.id))
      .map((cell) => cell.id);
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
        if (!isEndNodeId(nodeId)) {
          useProjectStore.getState().removeNode(nodeId);
        }
      }
    } finally {
      useProjectStore.getState().commitHistoryTransaction();
    }
    state.clearSelection();
    graph.cleanSelection();
  });
}
