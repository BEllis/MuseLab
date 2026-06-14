import type { Graph } from "@antv/x6";
import { patchNodeForAssetDrop } from "@/core/assets/applyAssetToNode";
import { selectActiveStory, useProjectStore } from "@/store/projectStore";
import { getAssetDragData, isAssetDrag } from "@/utils/dragDrop";

const ASSET_DROP_TARGET_KEY = "assetDropTarget";

function clearAssetDropHighlight(graph: Graph, nodeId: string | null): void {
  if (!nodeId) return;
  const cell = graph.getCellById(nodeId);
  if (!cell?.isNode()) return;
  const data = cell.getData<Record<string, unknown>>() ?? {};
  if (!data[ASSET_DROP_TARGET_KEY]) return;
  cell.setData({ ...data, [ASSET_DROP_TARGET_KEY]: false });
}

function setAssetDropHighlight(graph: Graph, nodeId: string | null): void {
  if (!nodeId) return;
  const cell = graph.getCellById(nodeId);
  if (!cell?.isNode()) return;
  const data = cell.getData<Record<string, unknown>>() ?? {};
  cell.setData({ ...data, [ASSET_DROP_TARGET_KEY]: true });
}

function nodeAtDropPoint(graph: Graph, clientX: number, clientY: number): string | null {
  const point = graph.clientToLocal(clientX, clientY);
  const nodes = graph.getNodesFromPoint(point.x, point.y);
  if (nodes.length === 0) return null;
  return nodes[nodes.length - 1].id;
}

export function bindGraphAssetDrop(graph: Graph): () => void {
  const container = graph.container;
  let highlightedNodeId: string | null = null;

  const clearHighlight = () => {
    clearAssetDropHighlight(graph, highlightedNodeId);
    highlightedNodeId = null;
  };

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer || !isAssetDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";

    const nodeId = nodeAtDropPoint(graph, event.clientX, event.clientY);
    if (nodeId === highlightedNodeId) return;

    clearAssetDropHighlight(graph, highlightedNodeId);
    highlightedNodeId = nodeId;
    setAssetDropHighlight(graph, nodeId);
  };

  const onDragLeave = (event: DragEvent) => {
    const related = event.relatedTarget;
    if (related instanceof Node && container.contains(related)) return;
    clearHighlight();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    clearHighlight();

    if (!event.dataTransfer) return;
    const data = getAssetDragData(event.dataTransfer);
    if (!data) return;

    const nodeId = nodeAtDropPoint(graph, event.clientX, event.clientY);
    if (!nodeId) return;

    const state = useProjectStore.getState();
    const story = selectActiveStory(state.project, state.activeStoryId);
    const domainNode = story.nodes.find((node) => node.id === nodeId);
    if (!domainNode) return;

    const patch = patchNodeForAssetDrop(state.project, domainNode, data);
    if (!patch) return;

    state.updateNode(nodeId, patch);
    state.setSelection([nodeId], []);
  };

  const onDragEnd = () => {
    clearHighlight();
  };

  container.addEventListener("dragover", onDragOver);
  container.addEventListener("dragleave", onDragLeave);
  container.addEventListener("drop", onDrop);
  window.addEventListener("dragend", onDragEnd);

  return () => {
    clearHighlight();
    container.removeEventListener("dragover", onDragOver);
    container.removeEventListener("dragleave", onDragLeave);
    container.removeEventListener("drop", onDrop);
    window.removeEventListener("dragend", onDragEnd);
  };
}
