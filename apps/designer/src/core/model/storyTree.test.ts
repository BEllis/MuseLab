import { describe, expect, it } from "vitest";
import { createStarterProject, addStory, addStoryGroup, removeStoryGroup } from "@/core/model/project";
import { buildStoryTree, getStoryTreeSiblings, placeStoryInTree } from "@/core/model/storyTree";

describe("buildStoryTree", () => {
  it("nests stories under groups", () => {
    const project = createStarterProject("Test");
    const act1 = addStoryGroup(project, "Act 1");
    const side = addStory(project, "Side quest", act1.id);

    const tree = buildStoryTree(project);
    expect(tree).toHaveLength(2);
    const group = tree.find((node) => node.kind === "group");
    expect(group?.kind).toBe("group");
    if (group?.kind !== "group") return;
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toMatchObject({ kind: "story", id: side.id });
  });

  it("reorders stories within the root list", () => {
    const project = createStarterProject("Test");
    const second = addStory(project, "Second");
    const third = addStory(project, "Third");
    const firstId = project.stories[0]!.id;

    placeStoryInTree(project, firstId, { index: 2 });

    expect(getStoryTreeSiblings(project).map((entry) => entry.id)).toEqual([
      second.id,
      third.id,
      firstId,
    ]);
  });

  it("promotes stories when a folder is removed", () => {
    const project = createStarterProject("Test");
    const act1 = addStoryGroup(project, "Act 1");
    const nested = addStoryGroup(project, "Nested", act1.id);
    const story = addStory(project, "Branch", nested.id);

    removeStoryGroup(project, act1.id);

    expect(project.storyGroups?.some((group) => group.id === act1.id)).toBe(false);
    expect(project.stories.find((entry) => entry.id === story.id)?.groupId).toBeUndefined();
  });
});
