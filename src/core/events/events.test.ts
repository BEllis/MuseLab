import { describe, expect, it } from "vitest";
import { createStarterProject } from "@/core/model/project";
import { migrateProjectBundle } from "@/core/model/projectBundle";
import { applyEvent } from "@/core/events/applyEvent";
import { cloneAppState, createEventMeta, getNavigationSnapshot } from "@/core/events/appState";
import {
  appendRecordedEvent,
  canRedoEventLog,
  canUndoEventLog,
  commitEventTransaction,
  createEventLogState,
  getRedoEvent,
  getUndoEvent,
  recordEvent,
  stepEventLogCursor,
} from "@/core/events/eventLog";
import { collectAssetIdsFromEventLog } from "@/core/events/eventLogAssets";
import { buildNavigationAfterSwitchStory } from "@/core/events/capture";
import type { AppState } from "@/core/events/appState";

function starterAppState(): AppState {
  const bundle = migrateProjectBundle(createStarterProject("Test"));
  return {
    project: bundle.project,
    promptsByLocale: bundle.promptsByLocale,
    activeStoryId: bundle.project.stories[0]!.id,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedAssetId: null,
    selectedModuleId: null,
    highlightedRootNodeIds: [],
  };
}

function roundTrip(state: AppState, event: Parameters<typeof applyEvent>[1]): AppState {
  const forward = applyEvent(state, event, "forward");
  return applyEvent(forward, event, "backward");
}

describe("applyEvent round trips", () => {
  it("restores project name updates", () => {
    const state = starterAppState();
    const event = {
      ...createEventMeta(),
      type: "updateProject" as const,
      before: { name: state.project.name },
      after: { name: "Renamed" },
    };
    expect(roundTrip(state, event)).toEqual(state);
  });

  it("restores active story navigation", () => {
    const state = starterAppState();
    const story = state.project.stories[0]!;
    state.project.stories.push({
      id: "story-2",
      name: "Second",
      nodes: [],
      edges: [],
      globalState: {},
    });
    const event = {
      ...createEventMeta(),
      type: "setActiveStoryId" as const,
      before: getNavigationSnapshot(state),
      after: buildNavigationAfterSwitchStory(state, "story-2"),
    };
    expect(roundTrip(state, event).activeStoryId).toBe(story.id);
  });

  it("restores added nodes", () => {
    const state = starterAppState();
    const storyId = state.activeStoryId;
    const node = {
      id: "node-added",
      type: "scene" as const,
      position: { x: 10, y: 20 },
    };
    const event = {
      ...createEventMeta(),
      type: "addNode" as const,
      storyId,
      before: null,
      after: node,
    };
    expect(roundTrip(state, event)).toEqual(state);
  });

  it("restores node position updates", () => {
    const state = starterAppState();
    const storyId = state.activeStoryId;
    const node = {
      id: "node-1",
      type: "scene" as const,
      position: { x: 10, y: 20 },
    };
    state.project.stories[0]!.nodes.push(node);
    const event = {
      ...createEventMeta(),
      type: "updateNodePosition" as const,
      storyId,
      nodeId: node.id,
      before: { x: 10, y: 20 },
      after: { x: 120, y: 48 },
    };
    const restored = roundTrip(state, event);
    expect(restored.project.stories[0]!.nodes.find((entry) => entry.id === node.id)?.position).toEqual({
      x: 10,
      y: 20,
    });
  });

  it("restores end node layout updates", () => {
    const state = starterAppState();
    const storyId = state.activeStoryId;
    const scene = {
      id: "scene-a",
      type: "scene" as const,
      position: { x: 10, y: 20 },
    };
    state.project.stories[0]!.nodes.push(scene);
    const event = {
      ...createEventMeta(),
      type: "updateEndNodeLayout" as const,
      storyId,
      sceneId: scene.id,
      before: null,
      after: {
        position: { x: 300, y: 80 },
        vertices: [{ x: 180, y: 60 }],
        manualRoute: true,
      },
    };
    const restored = roundTrip(state, event);
    expect(restored).toEqual(state);
  });
});

describe("eventLog", () => {
  it("coalesces repeated text edits into one undo step", () => {
    let log = createEventLogState();
    const base = {
      ...createEventMeta(),
      type: "updateNodePrompt" as const,
      storyId: "story-1",
      locale: "en",
      nodeId: "node-1",
      before: "",
    };
    log = recordEvent(log, { ...base, after: "H" }, { mergeKey: "node-text:node-1:en" });
    log = recordEvent(log, { ...base, after: "He" }, { mergeKey: "node-text:node-1:en" });
    expect(log.events).toHaveLength(1);
    expect(log.events[0]).toMatchObject({ after: "He" });
    expect(canUndoEventLog(log)).toBe(true);
  });

  it("supports undo and redo cursor movement", () => {
    let log = createEventLogState();
    const event = {
      ...createEventMeta(),
      type: "updateProject" as const,
      before: { name: "A" },
      after: { name: "B" },
    };
    log = appendRecordedEvent(log, event);
    expect(canUndoEventLog(log)).toBe(true);
    expect(canRedoEventLog(log)).toBe(false);
    expect(getUndoEvent(log)?.type).toBe("updateProject");

    log = stepEventLogCursor(log, -1);
    expect(canRedoEventLog(log)).toBe(true);
    expect(getRedoEvent(log)?.type).toBe("updateProject");
  });

  it("commits buffered transaction events as one batch", () => {
    let log = createEventLogState();
    log = { ...log, transactionDepth: 1, transactionBuffer: [] };
    const first = {
      ...createEventMeta(),
      type: "updateProject" as const,
      before: { name: "A" },
      after: { name: "B" },
    };
    const second = {
      ...createEventMeta(),
      type: "updateProject" as const,
      before: { name: "B" },
      after: { name: "C" },
    };
    log = recordEvent(log, first);
    log = recordEvent(log, second);
    const committed = commitEventTransaction(log);
    expect(committed.log.events).toHaveLength(1);
    expect(committed.log.events[0]?.type).toBe("batch");
  });

  it("retains asset ids referenced by undone add events", () => {
    let log = createEventLogState();
    log = appendRecordedEvent(log, {
      ...createEventMeta(),
      type: "addBlankActor",
      before: null,
      after: {
        id: "actor-1",
        type: "actor",
        name: "Hero",
        expressions: [{ id: "expr-1", name: "neutral" }],
      },
    });
    const ids = collectAssetIdsFromEventLog(log);
    expect(ids.has("actor-1")).toBe(true);
    expect(ids.has("actor-1:expr-1")).toBe(true);
  });
});

describe("cloneAppState", () => {
  it("deep clones project data", () => {
    const state = starterAppState();
    const clone = cloneAppState(state);
    clone.project.name = "Changed";
    expect(state.project.name).not.toBe("Changed");
  });
});
