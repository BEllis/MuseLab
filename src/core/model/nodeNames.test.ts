import { describe, expect, it } from "vitest";
import type { Project, Story } from "./types";
import {
  deriveUniqueNodeLabel,
  getJumpNodeDisplayName,
  getNodeDisplayName,
  incrementCloneLabel,
  isNodeLabelUnique,
  findDuplicateNodeNames,
} from "./nodeNames";

function storyWithLabels(...labels: Array<{ id: string; label?: string; type?: "scene" }>): Story {
  return {
    id: "story1",
    name: "Main",
    nodes: labels.map((entry, index) => ({
      id: entry.id,
      type: entry.type ?? "scene",
      position: { x: index * 10, y: 0 },
      label: entry.label,
      backdropId: "muselab-default-backdrop",
      actorConfigs: [],
      soundConfigs: [],
    })),
    edges: [],
    globalState: {},
  };
}

describe("nodeNames", () => {
  it("increments clone suffixes", () => {
    expect(incrementCloneLabel("Scene")).toBe("Scene (1)");
    expect(incrementCloneLabel("Scene (1)")).toBe("Scene (2)");
    expect(incrementCloneLabel("My Node (9)")).toBe("My Node (10)");
  });

  it("derives unique labels", () => {
    const story = storyWithLabels({ id: "a", label: "Scene" }, { id: "b", label: "Scene (1)" });
    expect(deriveUniqueNodeLabel(story, "Scene")).toBe("Scene (2)");
    expect(deriveUniqueNodeLabel(story, "New")).toBe("New");
  });

  it("uses type defaults for display names", () => {
    expect(getNodeDisplayName({ id: "1", type: "start", position: { x: 0, y: 0 } })).toBe("Start");
    expect(
      getNodeDisplayName({
        id: "1",
        type: "scene",
        position: { x: 0, y: 0 },
        label: "Opening",
      })
    ).toBe("Opening");
  });

  it("checks label uniqueness within a story", () => {
    const story = storyWithLabels({ id: "a", label: "Scene" });
    expect(isNodeLabelUnique(story, "Scene", "a")).toBe(true);
    expect(isNodeLabelUnique(story, "Scene", "b")).toBe(false);
  });

  it("derives jump display names from the target start node", () => {
    const project: Project = {
      name: "Test",
      assets: [],
      locales: ["en"],
      modules: [],
      stories: [
        {
          id: "story-a",
          name: "A",
          nodes: [
            { id: "start-a", type: "start", position: { x: 0, y: 0 }, label: "Intro" },
            {
              id: "jump-1",
              type: "jump",
              position: { x: 0, y: 0 },
              jumpTargetStartNodeId: "start-a",
            },
          ],
          edges: [],
          globalState: {},
        },
      ],
    };
    const jump = project.stories[0].nodes[1];
    expect(getJumpNodeDisplayName(jump, project)).toBe("Jump To Intro");
    expect(getNodeDisplayName(jump, project)).toBe("Jump To Intro");
    expect(getNodeDisplayName(jump)).toBe("Jump To");
  });

  it("ignores jump nodes in duplicate name checks", () => {
    const story: Story = {
      id: "story1",
      name: "Main",
      nodes: [
        { id: "start-a", type: "start", position: { x: 0, y: 0 }, label: "Intro" },
        {
          id: "jump-1",
          type: "jump",
          position: { x: 0, y: 0 },
          jumpTargetStoryId: "story1",
          jumpTargetStartNodeId: "start-a",
        },
        {
          id: "jump-2",
          type: "jump",
          position: { x: 10, y: 0 },
          jumpTargetStoryId: "story1",
          jumpTargetStartNodeId: "start-a",
        },
      ],
      edges: [],
      globalState: {},
    };
    expect(findDuplicateNodeNames(story)).toEqual([]);
  });
});
