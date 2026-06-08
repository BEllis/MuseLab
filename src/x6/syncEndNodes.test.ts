import { describe, expect, it } from "vitest";
import type { Story } from "@/core/model/types";
import { getTerminalSceneIds } from "./syncEndNodes";

function storyWithNodes(
  nodes: Story["nodes"],
  edges: Story["edges"] = []
): Story {
  return {
    id: "story-1",
    name: "Main",
    nodes,
    edges,
    globalState: {},
  };
}

describe("getTerminalSceneIds", () => {
  it("includes scenes with no outgoing edges", () => {
    const story = storyWithNodes([
      { id: "scene-a", type: "scene", position: { x: 0, y: 0 }, backdropId: "default", actorConfigs: [], soundConfigs: [] },
    ]);
    expect(getTerminalSceneIds(story)).toEqual(["scene-a"]);
  });

  it("excludes scenes linked to a jump node", () => {
    const story = storyWithNodes(
      [
        { id: "scene-a", type: "scene", position: { x: 0, y: 0 }, backdropId: "default", actorConfigs: [], soundConfigs: [] },
        { id: "jump-1", type: "jump", position: { x: 100, y: 0 }, jumpTargetStoryId: "story-1", jumpTargetStartNodeId: "start-1" },
      ],
      [{ id: "edge-1", sourceNodeId: "scene-a", targetNodeId: "jump-1" }]
    );
    expect(getTerminalSceneIds(story)).toEqual([]);
  });
});
