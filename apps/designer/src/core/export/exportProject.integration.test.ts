import { beforeAll, describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { createEmptyPromptsByLocale, setNodeTextTemplate } from "../locale/prompts";
import { makeRichExportProject } from "@/test/fixtures/richExportProject";
import {
  assertRichEngineTranspileOutput,
  installCliTranspileForTests,
  isCitoCliAvailable,
  transpileCiWithCli,
} from "@/test/citoTestHarness";
import { exportProject } from "./exportProject";
import { generateMuseLabEngineCi } from "./generateMuseLabEngineCi";

let citoCliReady = false;

beforeAll(async () => {
  citoCliReady = await installCliTranspileForTests();
});

describe("exportProject integration", () => {
  it("transpiles a rich project through exportProject into a complete archive", async (ctx) => {
    if (!citoCliReady) {
      ctx.skip();
    }

    const project = makeRichExportProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    setNodeTextTemplate(
      promptsByLocale.en,
      "story-main",
      "scene-main",
      '<p>Welcome @rt.GetString("name")</p>'
    );

    const archive = await exportProject(
      { project, promptsByLocale },
      { target: "cs", namespace: "Game", defaultLocale: "en" }
    );

    const entries = unzipSync(archive);
    const transpiled = strFromU8(entries["MuseLabEngine.cs"]);
    const ciSource = strFromU8(entries["cito/MuseLabEngine.ci"]);

    expect(transpiled).toContain("class MuseLabEngine");
    expect(transpiled).toContain("EvaluateEdgeCondition");
    expect(transpiled).toContain("GetJumpTargetStoryId");
    expect(transpiled).toContain("RenderNodePrompt");
    expect(ciSource).toBe(
      generateMuseLabEngineCi({
        project,
        promptsByLocale,
      })
    );
    expect(entries["project.json"]).toBeDefined();
    expect(entries["prompts.en.json"]).toBeDefined();
    expect(strFromU8(entries["README.md"])).toContain("C#");
  }, 120_000);

  it("transpiles the rich project to cs, py, and java via cito CLI", async (ctx) => {
    if (!isCitoCliAvailable()) {
      ctx.skip();
    }

    const project = makeRichExportProject();
    const ciSource = generateMuseLabEngineCi({
      project,
      promptsByLocale: createEmptyPromptsByLocale(project.locales),
    });

    for (const target of ["cs", "py", "java"] as const) {
      const output = await transpileCiWithCli(ciSource, target);
      assertRichEngineTranspileOutput(output, target);
    }
  }, 120_000);
});
