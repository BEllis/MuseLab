import { describe, expect, it } from "vitest";
import type { Project } from "../model/types";
import { createRunner } from "./runner";

function makeProject(): Project {
  return {
    name: "Test",
    assets: [],
    locales: ["en"],
    services: [],
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

describe("createRunner", () => {
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
