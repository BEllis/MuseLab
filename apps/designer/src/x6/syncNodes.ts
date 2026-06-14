import type { Graph, Node } from "@antv/x6";
import type { Project, Story, StoryNode } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
import { getDefaultLocale, getNodeTextTemplateForLocale } from "@/core/locale/prompts";
import { getNodeDisplayName } from "@/core/model/nodeNames";
import { isJumpNode, isSceneNode } from "@/core/model/nodeTypes";
import { getStoryOrNull } from "@/core/model/project";
import { syncNodeEdgePorts } from "./connectionPorts";
import { isEndNodeId } from "./constants";
import { applyNodeBoundaryTool } from "./nodeConfig";
import {
  applyNativeNodeStyle,
  isNativeNonSceneShape,
  isPathNodeShape,
  nodeDimensionsForShape,
  shapeForStoryNodeType,
  syncArrowNodeSize,
} from "./storyNodeShapes";

function buildJumpTargetSummary(
  project: Project,
  node: StoryNode
): string | undefined {
  if (!isJumpNode(node) || !node.jumpTargetStoryId || !node.jumpTargetStartNodeId) {
    return undefined;
  }
  const targetStory = getStoryOrNull(project, node.jumpTargetStoryId);
  const targetStart = targetStory?.nodes.find((n) => n.id === node.jumpTargetStartNodeId);
  const storyName = targetStory?.name ?? "Unknown story";
  const startName = targetStart ? getNodeDisplayName(targetStart) : "Unknown Start";
  return `${storyName} → ${startName}`;
}

function buildNodeData(
  node: StoryNode,
  project: Project,
  selectedNodeIds: ReadonlySet<string>,
  highlightedRootNodeIds: ReadonlySet<string>,
  preview: string
) {
  return {
    type: node.type,
    label: node.label,
    preview: preview.slice(0, 60) || "(no text)",
    selected: selectedNodeIds.has(node.id),
    invalidRoot: highlightedRootNodeIds.has(node.id),
    backdropId: node.backdropId,
    jumpTargetSummary: buildJumpTargetSummary(project, node),
  };
}

function nativeNodeCreateOptions(shape: string, label: string) {
  const size = nodeDimensionsForShape(shape, label);
  if (!size) return {};
  return {
    width: size.width,
    height: size.height,
    label,
  };
}

/** Views only re-translate when the store emits position changes (not silent). */
export function applyGraphNodePosition(node: Node, position: { x: number; y: number }): void {
  const current = node.getPosition();
  if (current.x === position.x && current.y === position.y) return;
  node.setPosition(position);
}

function addGraphNode(
  graph: Graph,
  project: Project,
  projectNode: StoryNode,
  data: ReturnType<typeof buildNodeData>
): Node | null {
  const shape = shapeForStoryNodeType(projectNode.type);
  const label = getNodeDisplayName(projectNode, project);

  graph.addNode({
    id: projectNode.id,
    shape,
    x: projectNode.position.x,
    y: projectNode.position.y,
    ...nativeNodeCreateOptions(shape, label),
    data,
  });

  const created = graph.getCellById(projectNode.id);
  return created?.isNode() ? created : null;
}

function syncNativeNodePresentation(
  node: Node,
  project: Project,
  projectNode: StoryNode,
  selectedNodeIds: ReadonlySet<string>,
  highlightedRootNodeIds: ReadonlySet<string>
): void {
  const label = getNodeDisplayName(projectNode, project);
  if (isPathNodeShape(node.shape)) {
    syncArrowNodeSize(node, label);
  }
  applyNativeNodeStyle(node, projectNode.type, label, {
    selected: selectedNodeIds.has(projectNode.id),
    invalidRoot: highlightedRootNodeIds.has(projectNode.id),
  });
}

export function syncProjectNode(
  graph: Graph,
  projectNode: StoryNode,
  selectedNodeIds: ReadonlySet<string>,
  highlightedRootNodeIds: ReadonlySet<string>,
  project: Project,
  story: Story,
  storyId: string,
  promptsByLocale: PromptsByLocale
): void {
  const locale = getDefaultLocale(project);
  const preview = isSceneNode(projectNode)
    ? getNodeTextTemplateForLocale(promptsByLocale, locale, storyId, projectNode.id)
    : "";
  const data = buildNodeData(
    projectNode,
    project,
    selectedNodeIds,
    highlightedRootNodeIds,
    preview
  );
  const expectedShape = shapeForStoryNodeType(projectNode.type);
  const existing = graph.getCellById(projectNode.id);

  if (existing?.isNode()) {
    const node = existing as Node;
    if (node.shape !== expectedShape) {
      const pos = node.getPosition();
      graph.removeNode(projectNode.id);
      graph.addNode({
        id: projectNode.id,
        shape: expectedShape,
        x: pos.x,
        y: pos.y,
        ...nativeNodeCreateOptions(expectedShape, getNodeDisplayName(projectNode, project)),
        data,
      });
      const recreated = graph.getCellById(projectNode.id);
      if (recreated?.isNode()) {
        syncNodeEdgePorts(recreated, projectNode, story, graph);
        if (isNativeNonSceneShape(expectedShape)) {
          syncNativeNodePresentation(
            recreated,
            project,
            projectNode,
            selectedNodeIds,
            highlightedRootNodeIds
          );
        }
        applyNodeBoundaryTool(recreated, selectedNodeIds.has(projectNode.id));
      }
      return;
    }

    syncNodeEdgePorts(node, projectNode, story, graph);
    applyGraphNodePosition(node, projectNode.position);
    if (isNativeNonSceneShape(expectedShape)) {
      syncNativeNodePresentation(
        node,
        project,
        projectNode,
        selectedNodeIds,
        highlightedRootNodeIds
      );
    }
    node.setData(data);
    applyNodeBoundaryTool(node, selectedNodeIds.has(projectNode.id));
    return;
  }

  const created = addGraphNode(graph, project, projectNode, data);
  if (created) {
    syncNodeEdgePorts(created, projectNode, story, graph);
    if (isNativeNonSceneShape(expectedShape)) {
      syncNativeNodePresentation(
        created,
        project,
        projectNode,
        selectedNodeIds,
        highlightedRootNodeIds
      );
    }
    applyNodeBoundaryTool(created, selectedNodeIds.has(projectNode.id));
  }
}

export function removeStaleNodes(graph: Graph, projectNodeIds: ReadonlySet<string>): void {
  for (const node of graph.getNodes()) {
    if (isEndNodeId(node.id)) continue;
    if (!projectNodeIds.has(node.id)) {
      graph.removeNode(node.id);
    }
  }
}
