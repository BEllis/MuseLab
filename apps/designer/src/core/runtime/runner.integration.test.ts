/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  createEmptyPromptsByLocale,
  setNodeSpeaker,
  setNodeTextTemplate,
} from "../locale/prompts";
import { createEmptyProject } from "../model/project";
import type { Project, Story } from "../model/types";
import {
  installCliTranspileForTests,
  isCitoCliAvailable,
} from "@/test/citoTestHarness";
import { createRunner } from "./runner";

function makeTemplateProject(): { project: Project; story: Story } {
  const project = createEmptyProject();
  const story: Story = {
    id: "story-1",
    name: "Main",
    entryNodeId: "start",
    globalState: { name: "Ada", flag: true, metGuide: false },
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 } },
      {
        id: "scene-a",
        type: "scene",
        position: { x: 100, y: 0 },
        backdropId: "muselab-default-backdrop",
      },
      {
        id: "scene-b",
        type: "scene",
        position: { x: 200, y: 0 },
        backdropId: "muselab-default-backdrop",
      },
    ],
    edges: [
      { id: "edge-open", sourceNodeId: "start", targetNodeId: "scene-a" },
      {
        id: "edge-flagged",
        sourceNodeId: "start",
        targetNodeId: "scene-b",
        condition: 'rt.GetBool("flag")',
      },
      {
        id: "edge-hidden",
        sourceNodeId: "start",
        targetNodeId: "scene-b",
        condition: 'rt.GetBool("metGuide")',
      },
    ],
  };
  project.stories = [story];
  return { project, story };
}

let citoTranspileReady = false;

beforeAll(async () => {
  citoTranspileReady = await installCliTranspileForTests();
});

describe("createRunner cito template integration", () => {
  it("renders scene html and speaker from real Cito templates", async (ctx) => {
    if (!citoTranspileReady) {
      ctx.skip();
    }

    const { project } = makeTemplateProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    setNodeTextTemplate(
      promptsByLocale.en,
      "story-1",
      "scene-a",
      '<p>Hello @rt.GetString("name")!</p>'
    );
    setNodeSpeaker(promptsByLocale.en, "story-1", "scene-a", '@rt.GetString("name")');

    const runner = createRunner(
      project,
      "story-1",
      "scene-a",
      promptsByLocale,
      project.locales[0].locale
    );

    const state = await runner.getRuntimeState();

    expect(state.currentHtml).toContain("Hello Ada!");
    expect(state.currentSpeaker).toBe("Ada");
    expect(state.promptInstructions.length).toBeGreaterThan(0);
    expect(state.promptInstructions.some((entry) => entry.kind === "appendHtml")).toBe(true);
  });

  it("evaluates edge conditions against runtime state", async (ctx) => {
    if (!citoTranspileReady) {
      ctx.skip();
    }

    const { project } = makeTemplateProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    const runner = createRunner(
      project,
      "story-1",
      "start",
      promptsByLocale,
      project.locales[0].locale
    );

    const choices = await runner.getChoices();
    const targets = choices.map((choice) => choice.targetNode.id).sort();

    expect(targets).toEqual(["scene-a", "scene-b"]);

    runner.context.setState("flag", false);
    const filtered = await runner.getChoices();

    expect(filtered.map((choice) => choice.targetNode.id)).toEqual(["scene-a"]);
  });

  it("requires the cito CLI for real template transpilation", (ctx) => {
    if (citoTranspileReady) {
      return;
    }
    if (!isCitoCliAvailable()) {
      ctx.skip();
    }
    throw new Error("Cito CLI is available but transpiler setup failed.");
  });
});
