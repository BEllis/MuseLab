import type { Project, Story } from "../model/types";
import { addStoryGroup } from "../model/project";
import { getNodeDisplayName } from "../model/nodeNames";
import { getPlayEntryNodeId } from "../model/graphHierarchy";
import { isStartNode } from "../model/nodeTypes";

export function formatStoryPath(groupPath: string, storyName: string): string {
  const trimmedName = storyName.trim();
  if (!groupPath.trim()) return trimmedName;
  return `${groupPath}/${trimmedName}`;
}

function resolveStoryGroupIdByPath(project: Project, groupPath: string): string | undefined {
  const segments = groupPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return undefined;

  let parentGroupId: string | undefined;
  for (const segment of segments) {
    const matches = (project.storyGroups ?? []).filter(
      (group) => group.name === segment && group.parentGroupId === parentGroupId
    );
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? `Story folder not found: "${groupPath}" (missing "${segment}")`
          : `Ambiguous story folder: "${segment}" in path "${groupPath}"`
      );
    }
    parentGroupId = matches[0].id;
  }
  return parentGroupId;
}

/** Create missing story folders along a path; returns the leaf group id. */
export function ensureStoryGroupIdByPath(
  project: Project,
  groupPath: string,
  notes?: string[]
): string | undefined {
  const segments = groupPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return undefined;

  if (!project.storyGroups) {
    project.storyGroups = [];
  }

  let parentGroupId: string | undefined;
  const createdSegments: string[] = [];
  for (const segment of segments) {
    const matches = project.storyGroups.filter(
      (group) => group.name === segment && group.parentGroupId === parentGroupId
    );
    if (matches.length === 1) {
      parentGroupId = matches[0].id;
      continue;
    }
    if (matches.length > 1) {
      throw new Error(`Ambiguous story folder: "${segment}" in path "${groupPath}"`);
    }
    const created = addStoryGroup(project, segment, parentGroupId);
    parentGroupId = created.id;
    createdSegments.push(segment);
    if (notes) {
      notes.push(`Added story folder "${createdSegments.join("/")}"`);
    }
  }
  return parentGroupId;
}

export function findStoryIdByPath(
  project: Project,
  groupPath: string,
  storyName: string
): string | null {
  try {
    return resolveStoryIdByPath(project, groupPath, storyName);
  } catch {
    return null;
  }
}

export function resolveStoryIdByPath(
  project: Project,
  groupPath: string,
  storyName: string
): string {
  const trimmedName = storyName.trim();
  if (!trimmedName) {
    throw new Error("Story name must not be empty");
  }

  const parentGroupId = resolveStoryGroupIdByPath(project, groupPath);
  const matches = project.stories.filter(
    (story) => story.name === trimmedName && story.groupId === parentGroupId
  );

  if (matches.length === 0) {
    throw new Error(`Story not found: "${groupPath}/${trimmedName}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous story name: "${trimmedName}" in "${groupPath}"`);
  }
  return matches[0].id;
}

export function resolveStartNodeIdByName(
  story: Story,
  project: Project,
  startNodeName: string
): string {
  const trimmedName = startNodeName.trim();
  if (!trimmedName) {
    throw new Error("Start node name must not be empty");
  }

  const matches = story.nodes.filter(
    (node) => isStartNode(node) && getNodeDisplayName(node, project) === trimmedName
  );

  if (matches.length === 0) {
    throw new Error(`Start node not found: "${trimmedName}" in story "${story.name}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous start node name: "${trimmedName}" in story "${story.name}"`);
  }
  return matches[0].id;
}

export function resolveStoryEntryNodeId(story: Story): string {
  const entryNodeId = getPlayEntryNodeId(story);
  if (!entryNodeId) {
    throw new Error(`Story "${story.name}" has no valid play entry configured`);
  }
  return entryNodeId;
}
