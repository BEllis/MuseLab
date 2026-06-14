import { describe, expect, it } from "vitest";
import type { StoryNode } from "@/core/model/types";
import { FREE_IN_PORT, FREE_OUT_PORT, endNodeIdForScene, sourcePortId } from "./constants";
import { validateStoryConnection } from "./validateStoryConnection";

function lookup(nodes: StoryNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (nodeId: string) => byId.get(nodeId) ?? null;
}

const start: StoryNode = { id: "start", type: "start", position: { x: 0, y: 0 }, label: "Start" };
const sceneA: StoryNode = {
  id: "scene-a",
  type: "scene",
  position: { x: 100, y: 0 },
  backdropId: "muselab-default-backdrop",
};
const sceneB: StoryNode = {
  id: "scene-b",
  type: "scene",
  position: { x: 200, y: 0 },
  backdropId: "muselab-default-backdrop",
};
const jump: StoryNode = {
  id: "jump",
  type: "jump",
  position: { x: 300, y: 0 },
  jumpTargetStoryId: "other",
  jumpTargetStartNodeId: "other-start",
};

describe("validateStoryConnection", () => {
  const nodes = [start, sceneA, sceneB, jump];
  const getNode = lookup(nodes);

  it("allows dragging from a start out port into empty space", () => {
    expect(
      validateStoryConnection({
        sourceNodeId: "start",
        targetNodeId: null,
        sourcePort: FREE_OUT_PORT,
        targetPort: null,
        lookupNode: getNode,
      })
    ).toBe(true);
  });

  it("allows start -> scene and scene -> scene connections on free in ports", () => {
    expect(
      validateStoryConnection({
        sourceNodeId: "start",
        targetNodeId: "scene-a",
        sourcePort: FREE_OUT_PORT,
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(true);

    expect(
      validateStoryConnection({
        sourceNodeId: "scene-a",
        targetNodeId: "scene-b",
        sourcePort: sourcePortId("edge-1"),
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(true);
  });

  it("allows scene -> jump connections", () => {
    expect(
      validateStoryConnection({
        sourceNodeId: "scene-a",
        targetNodeId: "jump",
        sourcePort: FREE_OUT_PORT,
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(true);
  });

  it("rejects non-out source ports", () => {
    expect(
      validateStoryConnection({
        sourceNodeId: "start",
        targetNodeId: "scene-a",
        sourcePort: FREE_IN_PORT,
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(false);
  });

  it("rejects jump and start nodes as connection sources", () => {
    expect(
      validateStoryConnection({
        sourceNodeId: "jump",
        targetNodeId: "scene-a",
        sourcePort: FREE_OUT_PORT,
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(false);
  });

  it("rejects self loops, end nodes, and non-free target ports", () => {
    expect(
      validateStoryConnection({
        sourceNodeId: "scene-a",
        targetNodeId: "scene-a",
        sourcePort: FREE_OUT_PORT,
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(false);

    expect(
      validateStoryConnection({
        sourceNodeId: "scene-a",
        targetNodeId: endNodeIdForScene("scene-a"),
        sourcePort: FREE_OUT_PORT,
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(false);

    expect(
      validateStoryConnection({
        sourceNodeId: "start",
        targetNodeId: "scene-a",
        sourcePort: FREE_OUT_PORT,
        targetPort: sourcePortId("edge-1"),
        lookupNode: getNode,
      })
    ).toBe(false);
  });

  it("rejects start nodes as targets", () => {
    expect(
      validateStoryConnection({
        sourceNodeId: "scene-a",
        targetNodeId: "start",
        sourcePort: FREE_OUT_PORT,
        targetPort: FREE_IN_PORT,
        lookupNode: getNode,
      })
    ).toBe(false);
  });
});
