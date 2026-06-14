import { describe, expect, it } from "vitest";
import {
  getPlayEntryNodeId,
  validateAllStories,
  validatePlayEntry,
} from "./graphHierarchy";
import { getPlayValidationMessage } from "./playValidationMessage";
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

  it("rejects an entry that points at a non-start node", () => {
    const story = makeStory({
      entryNodeId: "scene1",
      nodes: [
        { id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" },
        {
          id: "scene1",
          type: "scene",
          position: { x: 100, y: 0 },
          backdropId: "muselab-default-backdrop",
        },
      ],
    });
    expect(validatePlayEntry(story)).toEqual({
      ok: false,
      reason: "invalid_entry",
      entryNodeId: "scene1",
    });
  });
});

describe("getPlayEntryNodeId", () => {
  it("returns the configured entry when valid", () => {
    const story = makeStory({
      entryNodeId: "start1",
      nodes: [{ id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" }],
    });
    expect(getPlayEntryNodeId(story)).toBe("start1");
  });

  it("returns null when play entry is invalid", () => {
    expect(getPlayEntryNodeId(makeStory())).toBeNull();
  });
});

describe("validateAllStories", () => {
  it("returns null when every story is playable", () => {
    const valid = makeStory({
      id: "story-a",
      name: "A",
      entryNodeId: "start1",
      nodes: [{ id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" }],
    });
    expect(validateAllStories([valid])).toBeNull();
  });

  it("returns the first invalid story", () => {
    const valid = makeStory({
      id: "story-a",
      name: "A",
      entryNodeId: "start1",
      nodes: [{ id: "start1", type: "start", position: { x: 0, y: 0 }, label: "Start" }],
    });
    const invalid = makeStory({ id: "story-b", name: "B" });
    expect(validateAllStories([valid, invalid])).toEqual({
      storyId: "story-b",
      storyName: "B",
      validation: { ok: false, reason: "no_nodes" },
    });
  });
});

describe("getPlayValidationMessage", () => {
  it("maps validation reasons to user-facing copy", () => {
    expect(getPlayValidationMessage({ ok: false, reason: "no_nodes" })).toContain("Add at least one node");
    expect(getPlayValidationMessage({ ok: false, reason: "duplicate_names", duplicateNames: ["A", "B"] })).toContain(
      "A, B"
    );
  });
});
