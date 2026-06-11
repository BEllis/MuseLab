import { describe, expect, it } from "vitest";
import type { Project } from "../model/types";
import { normalizeLocales } from "../locale/localeTag";
import { createRunner } from "./runner";

function makeProject(): Project {
  return {
    name: "Test",
    assets: [],
    locales: normalizeLocales(["en"]),
    modules: [],
    stories: [
      {
        id: "main",
        name: "Main",
        entryNodeId: "start",
        globalState: {},
        nodes: [
          { id: "start", type: "start", position: { x: 0, y: 0 } },
          { id: "scene-1", type: "scene", position: { x: 100, y: 0 } },
          { id: "scene-2", type: "scene", position: { x: 200, y: 0 } },
          { id: "scene-final", type: "scene", position: { x: 300, y: 0 } },
        ],
        edges: [
          { id: "e1", sourceNodeId: "start", targetNodeId: "scene-1" },
          { id: "e2", sourceNodeId: "scene-1", targetNodeId: "scene-2" },
          {
            id: "e3",
            sourceNodeId: "scene-2",
            targetNodeId: "scene-final",
          },
        ],
      },
    ],
  };
}

const promptsByLocale = {
  en: {
    stories: {
      main: {
        nodes: {},
        edges: {
          e3: { optionText: "Continue" },
        },
      },
    },
  },
};

function makeCrossStoryProject(): Project {
  return {
    name: "Test",
    assets: [],
    locales: normalizeLocales(["en"]),
    modules: [],
    stories: [
      {
        id: "story-a",
        name: "Story A",
        entryNodeId: "start-a",
        globalState: {},
        nodes: [
          { id: "start-a", type: "start", position: { x: 0, y: 0 } },
          { id: "scene-a", type: "scene", position: { x: 100, y: 0 } },
          {
            id: "jump-b",
            type: "jump",
            position: { x: 200, y: 0 },
            jumpTargetStoryId: "story-b",
            jumpTargetStartNodeId: "start-b",
          },
        ],
        edges: [
          { id: "e-a1", sourceNodeId: "start-a", targetNodeId: "scene-a" },
          { id: "e-a2", sourceNodeId: "scene-a", targetNodeId: "jump-b" },
        ],
      },
      {
        id: "story-b",
        name: "Story B",
        entryNodeId: "start-b",
        globalState: {},
        nodes: [
          { id: "start-b", type: "start", position: { x: 0, y: 0 } },
          { id: "scene-b", type: "scene", position: { x: 100, y: 0 } },
        ],
        edges: [{ id: "e-b1", sourceNodeId: "start-b", targetNodeId: "scene-b" }],
      },
    ],
  };
}

describe("createRunner", () => {
  it("follows jump nodes into another story", async () => {
    const runner = createRunner(
      makeCrossStoryProject(),
      "story-a",
      "scene-a",
      { en: { stories: {} } },
      "en"
    );

    runner.goToNode("jump-b");

    expect(runner.activeStoryId).toBe("story-b");
    expect(runner.currentNodeId).toBe("start-b");

    const runtime = await runner.getRuntimeState();
    expect(runtime.activeStoryId).toBe("story-b");
    expect(runtime.currentNodeId).toBe("start-b");
    expect(runtime.choices).toHaveLength(1);
    expect(runtime.choices[0]?.targetNode.id).toBe("scene-b");

    runner.goToNode("scene-b");
    const sceneRuntime = await runner.getRuntimeState();
    expect(sceneRuntime.activeStoryId).toBe("story-b");
    expect(sceneRuntime.currentNodeId).toBe("scene-b");
  });

  it("resolves cross-story jump when only the target start id is stored", async () => {
    const project = makeCrossStoryProject();
    const jump = project.stories[0].nodes.find((node) => node.id === "jump-b");
    if (!jump || jump.type !== "jump") {
      throw new Error("Expected jump node in fixture");
    }
    delete jump.jumpTargetStoryId;

    const runner = createRunner(project, "story-a", "scene-a", { en: { stories: {} } }, "en");
    runner.goToNode("jump-b");

    expect(runner.activeStoryId).toBe("story-b");
    expect(runner.currentNodeId).toBe("start-b");
  });

  it("shows terminal scene content instead of ending immediately", async () => {
    const runner = createRunner(
      makeProject(),
      "main",
      "start",
      promptsByLocale,
      "en"
    );

    runner.goToNode("scene-2");
    runner.goToNode("scene-final");

    const runtime = await runner.getRuntimeState();

    expect(runtime.isEnded).toBe(false);
    expect(runtime.isTerminalScene).toBe(true);
    expect(runtime.currentNodeId).toBe("scene-final");
    expect(runtime.choices).toHaveLength(0);

    runner.finishStory();
    const ended = await runner.getRuntimeState();
    expect(ended.isEnded).toBe(true);
    expect(ended.isTerminalScene).toBe(true);
  });
});
