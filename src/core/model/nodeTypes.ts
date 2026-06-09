import type { Story, StoryNode, StoryNodeType } from "./types";

export function isStartNode(node: StoryNode): boolean {
  return node.type === "start";
}

export function isSceneNode(node: StoryNode): boolean {
  return node.type === "scene";
}

export function isJumpNode(node: StoryNode): boolean {
  return node.type === "jump";
}

export function getStartNodes(story: Story): StoryNode[] {
  return story.nodes.filter(isStartNode);
}

export function countSceneNodes(story: Story): number {
  return story.nodes.filter(isSceneNode).length;
}

export function normalizeStoryNode(node: StoryNode): StoryNode {
  const type: StoryNodeType = node.type ?? "scene";
  if (type === "start") {
    return {
      id: node.id,
      type: "start",
      position: node.position,
      label: node.label,
    };
  }
  if (type === "jump") {
    const { label: _label, ...rest } = node;
    return {
      id: rest.id,
      type: "jump",
      position: rest.position,
      jumpTargetStoryId: rest.jumpTargetStoryId,
      jumpTargetStartNodeId: rest.jumpTargetStartNodeId,
    };
  }
  return {
    id: node.id,
    type: "scene",
    position: node.position,
    label: node.label,
    backdropId: node.backdropId,
    actorConfigs: node.actorConfigs ?? [],
    soundConfigs: node.soundConfigs ?? [],
  };
}

/** Migrate legacy nodes to typed nodes and configure entryNodeId. */
export function migrateStoryNodes(story: Story): void {
  const hasIncoming = new Set(story.edges.map((edge) => edge.targetNodeId));

  for (const node of story.nodes) {
    if (!node.type) {
      node.type = "scene";
    }
    if (node.type === "scene") {
      node.actorConfigs = node.actorConfigs ?? [];
      node.soundConfigs = node.soundConfigs ?? [];
    }
    if (node.type === "jump") {
      delete node.label;
    }
  }

  const hasStart = story.nodes.some(isStartNode);
  if (!hasStart) {
    for (const node of story.nodes) {
      if (!hasIncoming.has(node.id)) {
        node.type = "start";
        delete node.backdropId;
        delete node.actorConfigs;
        delete node.soundConfigs;
      }
    }
  }

  const startNodes = getStartNodes(story);
  if (!story.entryNodeId && startNodes.length === 1) {
    story.entryNodeId = startNodes[0].id;
  }
}
