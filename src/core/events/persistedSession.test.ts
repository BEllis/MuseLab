import { describe, expect, it } from "vitest";
import { createStarterProject } from "@/core/model/project";
import { migrateProjectBundle, serializeStoredProjectPayload } from "@/core/model/projectBundle";
import { createEventLogState, appendRecordedEvent } from "@/core/events/eventLog";
import { createEventMeta } from "@/core/events/appState";
import {
  emptyStoredSession,
  parseSessionFromStorage,
  serializeSessionForStorage,
} from "@/core/events/persistedSession";

describe("persistedSession", () => {
  it("round-trips session through bundle payload", () => {
    const bundle = migrateProjectBundle(createStarterProject("Test"));
    const storyId = bundle.project.stories[0]!.id;
    let eventLog = createEventLogState();
    eventLog = appendRecordedEvent(eventLog, {
      ...createEventMeta(),
      type: "updateProject",
      before: { name: "Test" },
      after: { name: "Renamed" },
    });
    const session = {
      ...emptyStoredSession(storyId),
      selectedNodeIds: ["node-a"],
      eventLog,
    };

    const raw = serializeStoredProjectPayload(bundle, serializeSessionForStorage(session));
    const parsed = JSON.parse(raw) as { session: unknown };
    const restored = parseSessionFromStorage(parsed.session);

    expect(restored?.activeStoryId).toBe(storyId);
    expect(restored?.selectedNodeIds).toEqual(["node-a"]);
    expect(restored?.eventLog.cursor).toBe(0);
    expect(restored?.eventLog.events).toHaveLength(1);
  });

  it("rejects invalid event log cursor", () => {
    expect(
      parseSessionFromStorage({
        activeStoryId: "story-1",
        eventLog: { events: [], cursor: 1 },
      })
    ).toBeNull();
  });
});
