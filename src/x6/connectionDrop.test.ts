import { describe, expect, it } from "vitest";
import {
  connectionDropMenuOptions,
  isPreviewConnectionEdge,
  proposedNodePositionAtViewportCenter,
} from "./connectionDrop";
import type { StoryNode } from "@/core/model/types";

const sceneNode: StoryNode = {
  id: "scene-1",
  type: "scene",
  position: { x: 0, y: 0 },
  label: "Scene",
  backdropId: "default",
  actorConfigs: [],
  soundConfigs: [],
};

const startNode: StoryNode = {
  id: "start-1",
  type: "start",
  position: { x: 0, y: 0 },
  label: "Start",
};

describe("connectionDropMenuOptions", () => {
  it("includes clone for scene sources", () => {
    expect(connectionDropMenuOptions(sceneNode)).toEqual([
      "clone-scene",
      "new-scene",
      "jump",
      "cancel",
    ]);
  });

  it("omits clone for start sources", () => {
    expect(connectionDropMenuOptions(startNode)).toEqual(["new-scene", "jump", "cancel"]);
  });

  it("detects preview edges not yet in the project model", () => {
    const projectEdgeIds = new Set(["edge-1"]);
    expect(isPreviewConnectionEdge("edge-2", projectEdgeIds)).toBe(true);
    expect(isPreviewConnectionEdge("edge-1", projectEdgeIds)).toBe(false);
    expect(isPreviewConnectionEdge("end:edge:scene-1", projectEdgeIds)).toBe(false);
  });

  it("centers a new node on the viewport", () => {
    const graph = {
      clientToLocal: (clientX: number, clientY: number) => ({
        x: clientX - 100,
        y: clientY - 50,
      }),
    };
    const container = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        width: 400,
        height: 300,
        right: 500,
        bottom: 350,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }),
    } as HTMLElement;

    const position = proposedNodePositionAtViewportCenter(graph as never, container, []);

    expect(position).toEqual({ x: 100, y: 110 });
  });
});
