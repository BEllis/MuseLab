import { describe, expect, it } from "vitest";
import type { Project, Story } from "../model/types";
import {
  ensureStoryGroupIdByPath,
  resolveStartNodeIdByName,
  resolveStoryEntryNodeId,
  resolveStoryIdByPath,
} from "./resolveStoryPath";

function makeProject(overrides: Partial<Project> = {}): Project {
  const storyA: Story = {
    id: "story-a",
    name: "Main",
    groupId: "group-ch1",
    entryNodeId: "start-a",
    nodes: [
      { id: "start-a", type: "start", position: { x: 0, y: 0 }, label: "Intro" },
      { id: "start-b", type: "start", position: { x: 0, y: 0 }, label: "Alt" },
    ],
    edges: [],
    globalState: {},
  };

  return {
    name: "Test",
    assets: [],
    stories: [storyA],
    locales: [{ id: "en", locale: "en", displayName: "English" }],
    modules: [],
    storyGroups: [
      { id: "group-ch1", name: "Chapter1" },
      { id: "group-nested", name: "Nested", parentGroupId: "group-ch1" },
    ],
    ...overrides,
  };
}

describe("resolveStoryIdByPath", () => {
  it("resolves a story in a folder path", () => {
    const project = makeProject();
    expect(resolveStoryIdByPath(project, "Chapter1", "Main")).toBe("story-a");
  });

  it("resolves a story at the project root", () => {
    const project = makeProject({
      stories: [
        {
          id: "root-story",
          name: "Root",
          nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 } }],
          edges: [],
          globalState: {},
          entryNodeId: "start",
        },
      ],
    });
    expect(resolveStoryIdByPath(project, "", "Root")).toBe("root-story");
  });

  it("throws when the story folder is missing", () => {
    const project = makeProject();
    expect(() => resolveStoryIdByPath(project, "Missing", "Main")).toThrow(/Story folder not found/);
  });

  it("throws when the story name is ambiguous", () => {
    const project = makeProject({
      stories: [
        {
          id: "story-1",
          name: "Main",
          groupId: "group-ch1",
          nodes: [],
          edges: [],
          globalState: {},
        },
        {
          id: "story-2",
          name: "Main",
          groupId: "group-ch1",
          nodes: [],
          edges: [],
          globalState: {},
        },
      ],
    });
    expect(() => resolveStoryIdByPath(project, "Chapter1", "Main")).toThrow(/Ambiguous story name/);
  });
});

describe("ensureStoryGroupIdByPath", () => {
  it("creates missing story folders along a path", () => {
    const project = makeProject({ storyGroups: [] });
    const notes: string[] = [];
    const groupId = ensureStoryGroupIdByPath(project, "Chapter1/Nested", notes);

    expect(project.storyGroups).toHaveLength(2);
    expect(project.storyGroups?.[0]?.name).toBe("Chapter1");
    expect(project.storyGroups?.[1]?.name).toBe("Nested");
    expect(project.storyGroups?.[1]?.parentGroupId).toBe(project.storyGroups?.[0]?.id);
    expect(groupId).toBe(project.storyGroups?.[1]?.id);
    expect(notes).toEqual([
      'Added story folder "Chapter1"',
      'Added story folder "Chapter1/Nested"',
    ]);
  });

  it("reuses existing folders without notes", () => {
    const project = makeProject();
    const notes: string[] = [];
    const groupId = ensureStoryGroupIdByPath(project, "Chapter1", notes);

    expect(groupId).toBe("group-ch1");
    expect(notes).toEqual([]);
  });
});

describe("resolveStartNodeIdByName", () => {
  it("resolves a start node by display name", () => {
    const project = makeProject();
    const story = project.stories[0];
    expect(resolveStartNodeIdByName(story, project, "Intro")).toBe("start-a");
  });

  it("throws when the start node is missing", () => {
    const project = makeProject();
    const story = project.stories[0];
    expect(() => resolveStartNodeIdByName(story, project, "Missing")).toThrow(/Start node not found/);
  });
});

describe("resolveStoryEntryNodeId", () => {
  it("returns the configured entry node", () => {
    const project = makeProject();
    expect(resolveStoryEntryNodeId(project.stories[0])).toBe("start-a");
  });
});
