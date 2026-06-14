import { describe, expect, it } from "vitest";
import { createEmptyPromptsByLocale } from "../locale/prompts";
import { createEmptyProject } from "../model/project";
import type { Project, Story } from "../model/types";
import { createRunner } from "./runner";

function makeJumpProject(): { project: Project; storyA: Story; storyB: Story } {
  const project = createEmptyProject();
  const storyA: Story = {
    id: "story-a",
    name: "Story A",
    entryNodeId: "start-a",
    globalState: { trust: 0, metGuide: false },
    nodes: [
      { id: "start-a", type: "start", position: { x: 0, y: 0 } },
      {
        id: "jump-a",
        type: "jump",
        position: { x: 100, y: 0 },
        jumpTargetStoryId: "story-b",
        jumpTargetStartNodeId: "start-b",
      },
    ],
    edges: [{ id: "edge-a", sourceNodeId: "start-a", targetNodeId: "jump-a" }],
  };
  const storyB: Story = {
    id: "story-b",
    name: "Story B",
    entryNodeId: "start-b",
    globalState: { trust: 5, chapterStarted: false },
    nodes: [{ id: "start-b", type: "start", position: { x: 0, y: 0 } }],
    edges: [],
  };
  project.stories = [storyA, storyB];
  return { project, storyA, storyB };
}

describe("createRunner story switching", () => {
  it("preserves runtime state across story jumps and only fills missing defaults", () => {
    const { project } = makeJumpProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    const runner = createRunner(
      project,
      "story-a",
      "start-a",
      promptsByLocale,
      project.locales[0].locale
    );

    runner.context.setState("trust", 3);
    runner.context.setState("metGuide", true);
    runner.goToNode("jump-a");

    expect(runner.activeStoryId).toBe("story-b");
    expect(runner.state.trust).toBe(3);
    expect(runner.state.metGuide).toBe(true);
    expect(runner.state.chapterStarted).toBe(false);
  });
});
