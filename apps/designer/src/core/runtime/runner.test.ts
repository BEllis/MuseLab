import { describe, expect, it } from "vitest";
import { createEmptyPromptsByLocale, setEdgeOptionText } from "../locale/prompts";
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

function makeBranchProject(): { project: Project; story: Story } {
  const project = createEmptyProject();
  const story: Story = {
    id: "story-1",
    name: "Main",
    entryNodeId: "start",
    globalState: { flag: true },
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 } },
      {
        id: "scene-a",
        type: "scene",
        position: { x: 100, y: 0 },
        backdropId: "muselab-default-backdrop",
      },
      {
        id: "scene-b",
        type: "scene",
        position: { x: 200, y: 0 },
        backdropId: "muselab-default-backdrop",
      },
      {
        id: "scene-terminal",
        type: "scene",
        position: { x: 300, y: 0 },
        backdropId: "muselab-default-backdrop",
        soundConfigs: [{ assetId: "sfx-1", startOnLoad: true }],
      },
    ],
    edges: [
      { id: "edge-open", sourceNodeId: "start", targetNodeId: "scene-a" },
      {
        id: "edge-hidden",
        sourceNodeId: "start",
        targetNodeId: "scene-b",
        condition: "this is not valid cito {{",
      },
      { id: "edge-forward", sourceNodeId: "scene-a", targetNodeId: "scene-terminal" },
    ],
  };
  project.stories = [story];
  project.assets.push({ id: "sfx-1", type: "sound", name: "Click" });
  return { project, story };
}

function createTestRunner(project: Project, storyId: string, nodeId: string) {
  const promptsByLocale = createEmptyPromptsByLocale(project.locales);
  return createRunner(
    project,
    storyId,
    nodeId,
    promptsByLocale,
    project.locales[0].locale
  );
}

describe("createRunner story switching", () => {
  it("preserves runtime state across story jumps and only fills missing defaults", () => {
    const { project } = makeJumpProject();
    const runner = createTestRunner(project, "story-a", "start-a");

    runner.context.setState("trust", 3);
    runner.context.setState("metGuide", true);
    runner.goToNode("jump-a");

    expect(runner.activeStoryId).toBe("story-b");
    expect(runner.state.trust).toBe(3);
    expect(runner.state.metGuide).toBe(true);
    expect(runner.state.chapterStarted).toBe(false);
  });
});

describe("createRunner navigation", () => {
  it("throws when navigating to a missing node", () => {
    const { project } = makeBranchProject();
    const runner = createTestRunner(project, "story-1", "start");

    expect(() => runner.goToNode("missing")).toThrow(/Node "missing" not found/);
  });

  it("marks the story ended after finishStory", async () => {
    const { project } = makeBranchProject();
    const runner = createTestRunner(project, "story-1", "start");

    runner.finishStory();
    const state = await runner.getRuntimeState();

    expect(state.isEnded).toBe(true);
  });

  it("updates active locale", () => {
    const { project } = makeBranchProject();
    const runner = createTestRunner(project, "story-1", "start");

    runner.setActiveLocale("de");
    expect(runner.activeLocale).toBe("de");
  });
});

describe("createRunner choices", () => {
  it("offers scene targets from start nodes and omits invalid conditions", async () => {
    const { project } = makeBranchProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    setEdgeOptionText(promptsByLocale.en, "story-1", "edge-open", "Continue");
    const runner = createRunner(
      project,
      "story-1",
      "start",
      promptsByLocale,
      project.locales[0].locale
    );

    const choices = await runner.getChoices();

    expect(choices).toHaveLength(1);
    expect(choices[0]?.edge.id).toBe("edge-open");
    expect(choices[0]?.targetNode.id).toBe("scene-a");
    expect(choices[0]?.optionText).toBe("Continue");
  });

  it("includes option text for scene-to-scene choices", async () => {
    const { project } = makeBranchProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    setEdgeOptionText(promptsByLocale.en, "story-1", "edge-forward", "Go on");
    const runner = createRunner(
      project,
      "story-1",
      "scene-a",
      promptsByLocale,
      project.locales[0].locale
    );

    const choices = await runner.getChoices();

    expect(choices).toHaveLength(1);
    expect(choices[0]?.optionText).toBe("Go on");
  });

  it("detects terminal scenes with no continuation", async () => {
    const { project } = makeBranchProject();
    const runner = createTestRunner(project, "story-1", "scene-terminal");

    const state = await runner.getRuntimeState();

    expect(state.choices).toHaveLength(0);
    expect(state.isTerminalScene).toBe(true);
    expect(state.isEnded).toBe(false);
  });
});

describe("createRunner callbacks", () => {
  it("forwards emit, call, and playSound through the template context", () => {
    const { project } = makeBranchProject();
    const emitted: string[] = [];
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const sounds: string[] = [];
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    const runner = createRunner(
      project,
      "story-1",
      "start",
      promptsByLocale,
      project.locales[0].locale,
      {
        onEmit: (eventName) => emitted.push(eventName),
        onCall: (name, ...args) => {
          calls.push({ name, args });
          return 42;
        },
        onPlaySound: (assetId) => sounds.push(assetId),
      }
    );

    runner.context.emit("scene-enter");
    expect(runner.context.call("helper", "x")).toBe(42);
    runner.context.playSound("sfx-1");

    expect(emitted).toEqual(["scene-enter"]);
    expect(calls).toEqual([{ name: "helper", args: ["x"] }]);
    expect(sounds).toEqual(["sfx-1"]);
  });
});

describe("createRunner scene assets", () => {
  it("returns sound configs for the current scene node", () => {
    const { project } = makeBranchProject();
    const runner = createTestRunner(project, "story-1", "scene-terminal");

    expect(runner.getSoundConfigsForCurrentNode()).toEqual([
      { assetId: "sfx-1", startOnLoad: true },
    ]);
  });

  it("returns no sound configs on start nodes", () => {
    const { project } = makeBranchProject();
    const runner = createTestRunner(project, "story-1", "start");

    expect(runner.getSoundConfigsForCurrentNode()).toEqual([]);
  });
});
