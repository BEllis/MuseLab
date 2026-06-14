import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { describe, it } from "vitest";
import {
  emptyStoredSession,
  serializeSessionForStorage,
} from "../../core/events/persistedSession";
import {
  createEmptyPromptsByLocale,
  setEdgeOptionText,
  setNodeTextTemplate,
} from "../../core/locale/prompts";
import {
  addEdge,
  addNode,
  createStarterProject,
  getFirstStoryId,
  getStory,
} from "../../core/model/project";
import { serializeStoredProjectPayload } from "../../core/model/projectBundle";

const outDir = path.join(import.meta.dirname, "../../../e2e/fixtures/data");

describe("generate e2e fixtures", () => {
  it("writes starter and playable project payloads", () => {
    const starterProject = createStarterProject("E2E Starter");
    const starterStoryId = getFirstStoryId(starterProject);
    const starterPrompts = createEmptyPromptsByLocale(starterProject.locales);

    const playableProject = createStarterProject("E2E Playable");
    const playableStoryId = getFirstStoryId(playableProject);
    const playableStory = getStory(playableProject, playableStoryId);
    const startId = playableStory.entryNodeId;
    if (!startId) {
      throw new Error("Playable fixture requires a configured start node");
    }
    const scene = addNode(playableProject, playableStoryId, { x: 420, y: 120 }, "scene");
    const edge = addEdge(playableProject, playableStoryId, startId, scene.id);
    const playablePrompts = createEmptyPromptsByLocale(playableProject.locales);
    setNodeTextTemplate(
      playablePrompts.en,
      playableStoryId,
      scene.id,
      "<p>Welcome to MuseLab</p>"
    );
    setEdgeOptionText(playablePrompts.en, playableStoryId, edge.id, "Begin");

    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, "starter-project.json"),
      serializeStoredProjectPayload(
        { project: starterProject, promptsByLocale: starterPrompts },
        serializeSessionForStorage(emptyStoredSession(starterStoryId))
      )
    );
    writeFileSync(
      path.join(outDir, "playable-project.json"),
      serializeStoredProjectPayload(
        { project: playableProject, promptsByLocale: playablePrompts },
        serializeSessionForStorage(emptyStoredSession(playableStoryId))
      )
    );
  });
});
