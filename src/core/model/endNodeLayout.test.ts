import { describe, expect, it } from "vitest";
import { parseProject, serializeProject } from "@/core/model/project";
import {
  defaultEndNodePosition,
  END_NODE_GAP,
  endNodePositionForSceneBounds,
  endNodeLayoutsEqual,
  getTerminalSceneIds,
  mergeEndNodeLayout,
  pruneEndNodeLayouts,
  resolveEndNodePosition,
} from "@/core/model/endNodeLayout";
import type { Story } from "@/core/model/types";

function storyWithNodes(
  nodes: Story["nodes"],
  edges: Story["edges"] = [],
  endNodeLayouts?: Story["endNodeLayouts"]
): Story {
  return {
    id: "story-1",
    name: "Main",
    nodes,
    edges,
    globalState: {},
    endNodeLayouts,
  };
}

describe("endNodeLayout", () => {
  it("derives end position from the parent scene", () => {
    const story = storyWithNodes(
      [{ id: "scene-a", type: "scene", position: { x: 0, y: 0 } }],
      [],
      { "scene-a": { position: { x: 400, y: 120 } } }
    );
    const scenePosition = { x: 40, y: 80 };

    expect(resolveEndNodePosition(story, "scene-a", scenePosition)).toEqual(
      defaultEndNodePosition(scenePosition)
    );
    expect(defaultEndNodePosition({ x: 0, y: 0 }).x).toBeGreaterThan(0);
  });

  it("centers the end node vertically against the scene bounds", () => {
    const scenePosition = { x: 10, y: 20 };
    const sceneSize = { width: 220, height: 140 };

    expect(endNodePositionForSceneBounds(scenePosition, sceneSize)).toEqual({
      x: scenePosition.x + sceneSize.width + END_NODE_GAP,
      y: scenePosition.y + (sceneSize.height - 52) / 2,
    });
    expect(resolveEndNodePosition(storyWithNodes([]), "scene-a", scenePosition, sceneSize)).toEqual(
      endNodePositionForSceneBounds(scenePosition, sceneSize)
    );
  });

  it("drops stored layouts when a scene is no longer terminal", () => {
    const story = storyWithNodes(
      [
        { id: "scene-a", type: "scene", position: { x: 0, y: 0 } },
        { id: "jump-1", type: "jump", position: { x: 100, y: 0 } },
      ],
      [{ id: "edge-1", sourceNodeId: "scene-a", targetNodeId: "jump-1" }],
      { "scene-a": { position: { x: 400, y: 120 } } }
    );

    pruneEndNodeLayouts(story);
    expect(story.endNodeLayouts).toBeUndefined();
    expect(getTerminalSceneIds(story)).toEqual([]);
  });

  it("merges edge routing metadata into the stored layout", () => {
    const merged = mergeEndNodeLayout(
      { position: { x: 10, y: 20 } },
      { vertices: [{ x: 100, y: 40 }], manualRoute: true },
      { x: 0, y: 0 }
    );

    expect(merged).toEqual({
      position: { x: 10, y: 20 },
      vertices: [{ x: 100, y: 40 }],
      manualRoute: true,
    });
    expect(
      endNodeLayoutsEqual(merged, {
        position: { x: 10, y: 20 },
        vertices: [{ x: 100, y: 40 }],
        manualRoute: true,
      })
    ).toBe(true);
  });

  it("survives project manifest serialize and parse", () => {
    const layout = {
      position: { x: 420, y: 96 },
      vertices: [{ x: 200, y: 40 }],
      manualRoute: true,
    };
    const raw = serializeProject({
      name: "Test",
      assets: [],
      locales: ["en"],
      modules: [],
      stories: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Main",
          nodes: [
            {
              id: "660e8400-e29b-41d4-a716-446655440001",
              type: "scene",
              position: { x: 0, y: 0 },
            },
          ],
          edges: [],
          globalState: {},
          endNodeLayouts: {
            "660e8400-e29b-41d4-a716-446655440001": layout,
          },
        },
      ],
    });

    const project = parseProject(raw);
    expect(project.stories[0]?.endNodeLayouts).toBeUndefined();
  });
});

describe("getTerminalSceneIds", () => {
  it("includes scenes with no outgoing edges", () => {
    const story = storyWithNodes([
      { id: "scene-a", type: "scene", position: { x: 0, y: 0 } },
    ]);
    expect(getTerminalSceneIds(story)).toEqual(["scene-a"]);
  });

  it("excludes scenes linked to a jump node", () => {
    const story = storyWithNodes(
      [
        { id: "scene-a", type: "scene", position: { x: 0, y: 0 } },
        { id: "jump-1", type: "jump", position: { x: 100, y: 0 } },
      ],
      [{ id: "edge-1", sourceNodeId: "scene-a", targetNodeId: "jump-1" }]
    );
    expect(getTerminalSceneIds(story)).toEqual([]);
  });
});
