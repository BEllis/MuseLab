import { copyOptionalAttributes } from "./attributes";
import type { ActorSceneConfig, SoundConfig, Story, StoryNode, StoryNodeType } from "./types";

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

function normalizeActorSceneConfig(config: ActorSceneConfig): ActorSceneConfig {
  return {
    assetId: config.assetId,
    expressionId: config.expressionId,
    ...copyOptionalAttributes(config),
  };
}

function normalizeSoundConfig(config: SoundConfig): SoundConfig {
  return {
    assetId: config.assetId,
    startOnLoad: config.startOnLoad,
    stopOnLoad: config.stopOnLoad,
    loop: config.loop,
    startTime: config.startTime,
    endTime: config.endTime,
    ...copyOptionalAttributes(config),
  };
}

export function normalizeStoryNode(node: StoryNode): StoryNode {
  const type: StoryNodeType = node.type ?? "scene";
  if (type === "start") {
    return {
      id: node.id,
      type: "start",
      position: node.position,
      label: node.label,
      ...copyOptionalAttributes(node),
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
      ...copyOptionalAttributes(rest),
    };
  }
  return {
    id: node.id,
    type: "scene",
    position: node.position,
    label: node.label,
    backdropId: node.backdropId,
    actorConfigs: (node.actorConfigs ?? []).map(normalizeActorSceneConfig),
    soundConfigs: (node.soundConfigs ?? []).map(normalizeSoundConfig),
    ...copyOptionalAttributes(node),
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
