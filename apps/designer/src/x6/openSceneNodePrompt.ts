import type { Graph } from "@antv/x6";
import { getDefaultLocale } from "@/core/locale/prompts";
import { isSceneNode } from "@/core/model/nodeTypes";
import { selectActiveStory, useProjectStore } from "@/store/projectStore";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import { isEndNodeId } from "./constants";

export function openSceneNodePrompt(
  graph: Graph | null,
  nodeId: string,
  mode: "view" | "edit"
): void {
  if (!nodeId || isEndNodeId(nodeId)) return;

  const store = useProjectStore.getState();
  const story = selectActiveStory(store.project, store.activeStoryId);
  const node = story.nodes.find((entry) => entry.id === nodeId);
  if (!node || !isSceneNode(node)) return;

  const locale = getDefaultLocale(store.project);
  store.setSelection([node.id], []);
  if (graph) {
    graph.cleanSelection();
    const cell = graph.getCellById(node.id);
    if (cell) graph.select(cell);
  }

  const previewStore = useSceneEditorPreviewStore.getState();
  if (mode === "view") {
    previewStore.showPreview({ locale, editingActions: false });
    return;
  }
  previewStore.showActionEditor(locale);
}
