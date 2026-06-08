import { describe, expect, it } from "vitest";
import { validatePlayEntry } from "./graphHierarchy";
import type { Story } from "./types";

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: "story1",
    name: "Main",
    nodes: [],
    edges: [],
    globalState: {},
    ...overrides,
  };
}

describe("validatePlayEntry", () => {
  it("requires at least one node", () => {
    expect(validatePlayEntry(makeStory())).toEqual({ ok: false, reason: "no_nodes" });
  });

  it("requires at least one Start node", () => {
    const story = makeStory({
      nodes: [
        {
          id: "scene1",
          type: "scene",
          position: { x: 0, y: 0 },
          backdropId: "muselab-default-backdrop",
          actorConfigs: [],
          soundConfigs: [],
        },
      ],
    });
    expect(validatePlayEntry(story)).toEqual({ ok: false, reason: "no_starts" });
  });

  it("requires a configured entry Start", () => {
    const story = makeStory({
      nodes: [{ id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" }],
    });
    expect(validatePlayEntry(story)).toEqual({ ok: false, reason: "no_entry_configured" });
  });

  it("rejects invalid entry references", () => {
    const story = makeStory({
      entryNodeId: "missing",
      nodes: [{ id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" }],
    });
    expect(validatePlayEntry(story)).toEqual({
      ok: false,
      reason: "invalid_entry",
      entryNodeId: "missing",
    });
  });

  it("accepts a valid configured Start", () => {
    const story = makeStory({
      entryNodeId: "start1",
      nodes: [{ id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" }],
    });
    expect(validatePlayEntry(story)).toEqual({ ok: true, entryNodeId: "start1" });
  });

  it("rejects duplicate node names", () => {
    const story = makeStory({
      entryNodeId: "start1",
      nodes: [
        { id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" },
        { id: "scene1", type: "scene", position: { x: 0, y: 0 }, label: "Start" },
      ],
    });
    const result = validatePlayEntry(story);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("duplicate_names");
      expect(result.duplicateNames).toEqual(["Start"]);
    }
  });
});
