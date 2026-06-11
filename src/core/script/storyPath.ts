import type { Project } from "../model/types";

export function getStoryGroupPath(project: Project, groupId?: string): string {
  if (!groupId) return "";
  const groups = project.storyGroups ?? [];
  const segments: string[] = [];
  let current: string | undefined = groupId;
  while (current) {
    const group = groups.find((entry) => entry.id === current);
    if (!group) break;
    segments.unshift(group.name);
    current = group.parentGroupId;
  }
  return segments.join("/");
}
