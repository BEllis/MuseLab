import type { Project, Story, StoryNode, StoryNodeType } from "./types";
import { isJumpNode, isStartNode } from "./nodeTypes";

const TYPE_DEFAULT_LABELS: Record<Exclude<StoryNodeType, "jump">, string> = {
  start: "Start",
  scene: "Scene",
};

const CLONE_SUFFIX_RE = /^(.+) \((\d+)\)$/;

function findJumpTargetStart(
  project: Project,
  jumpTargetStoryId: string,
  jumpTargetStartNodeId: string
): StoryNode | null {
  const targetStory = project.stories.find((story) => story.id === jumpTargetStoryId);
  const targetStart = targetStory?.nodes.find((node) => node.id === jumpTargetStartNodeId);
  return targetStart != null && isStartNode(targetStart) ? targetStart : null;
}

/** Resolve the story id for a jump's target start (explicit field or project lookup). */
export function resolveJumpTargetStoryId(
  project: Project,
  node: StoryNode
): string | undefined {
  if (node.jumpTargetStoryId) {
    return node.jumpTargetStoryId;
  }
  if (!node.jumpTargetStartNodeId) {
    return undefined;
  }
  for (const story of project.stories) {
    const start = story.nodes.find(
      (entry) => entry.id === node.jumpTargetStartNodeId && isStartNode(entry)
    );
    if (start) {
      return story.id;
    }
  }
  return undefined;
}

export function getJumpNodeDisplayName(node: StoryNode, project?: Project): string {
  if (!project || !node.jumpTargetStartNodeId) {
    return "Jump To";
  }
  const jumpTargetStoryId = resolveJumpTargetStoryId(project, node);
  if (!jumpTargetStoryId) {
    return "Jump To";
  }
  const targetStart = findJumpTargetStart(
    project,
    jumpTargetStoryId,
    node.jumpTargetStartNodeId
  );
  if (!targetStart) {
    return "Jump To";
  }
  const startName = getNodeDisplayName(targetStart, project);
  return `Jump To ${startName}`;
}

export function getDefaultLabelForType(type: StoryNodeType): string {
  if (type === "jump") {
    return "Jump To";
  }
  return TYPE_DEFAULT_LABELS[type];
}

export function getNodeDisplayName(node: StoryNode, project?: Project): string {
  if (isJumpNode(node)) {
    return getJumpNodeDisplayName(node, project);
  }
  return node.label?.trim() || getDefaultLabelForType(node.type);
}

export function incrementCloneLabel(label: string): string {
  const match = label.match(CLONE_SUFFIX_RE);
  if (match) {
    return `${match[1]} (${Number(match[2]) + 1})`;
  }
  return `${label} (1)`;
}

export function deriveUniqueNodeLabel(story: Story, baseLabel: string): string {
  const used = new Set(
    story.nodes
      .filter((node) => !isJumpNode(node))
      .map((node) => getNodeDisplayName(node))
  );
  if (!used.has(baseLabel)) {
    return baseLabel;
  }
  let candidate = incrementCloneLabel(baseLabel);
  while (used.has(candidate)) {
    candidate = incrementCloneLabel(candidate);
  }
  return candidate;
}

export function findDuplicateNodeNames(story: Story, project?: Project): string[] {
  const counts = new Map<string, number>();
  for (const node of story.nodes) {
    if (isJumpNode(node)) continue;
    const name = getNodeDisplayName(node, project);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

export function migrateJumpNodeTargets(project: Project): void {
  for (const story of project.stories) {
    for (const node of story.nodes) {
      if (!isJumpNode(node) || !node.jumpTargetStartNodeId) continue;
      const resolvedStoryId = resolveJumpTargetStoryId(project, node);
      if (resolvedStoryId && node.jumpTargetStoryId !== resolvedStoryId) {
        node.jumpTargetStoryId = resolvedStoryId;
      }
    }
  }
}

export function isNodeLabelUnique(
  story: Story,
  label: string,
  excludeNodeId?: string
): boolean {
  const normalized = label.trim();
  if (!normalized) return false;
  return !story.nodes.some(
    (node) =>
      !isJumpNode(node) &&
      node.id !== excludeNodeId &&
      getNodeDisplayName(node) === normalized
  );
}
