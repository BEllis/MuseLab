import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { createEmptyPromptsByLocale } from "../locale/prompts";
import { makeRichExportProject } from "@/test/fixtures/richExportProject";
import {
  assertRichEngineTranspileOutput,
  isCitoCliAvailable,
  transpileCiWithCli,
} from "@/test/citoTestHarness";
import { generateMuseLabEngineCi } from "./generateMuseLabEngineCi";

const FIXTURE_CI = `public abstract class IMuseLabRuntime
{
    public abstract string GetString(string key);
}

public abstract class IMuseLabFormat
{
    public abstract string BoldStart();
}

public abstract class IMuseLabPromptRenderer
{
    public abstract void AddLiteral(string text);
    public abstract string Render();
}

public static class MuseLabProjectData
{
    public static string GetStoryEntryNodeId(string storyId)
    {
        return "start-1";
    }
}

public class MuseLabEngine
{
    IMuseLabRuntime rt;
    IMuseLabFormat format;
    IMuseLabPromptRenderer prompter;
    string activeLocale;

    public MuseLabEngine()
    {
    }

    public static MuseLabEngine# Create(IMuseLabRuntime rt, IMuseLabFormat format, IMuseLabPromptRenderer prompter, string defaultLocale)
    {
        MuseLabEngine# engine = new MuseLabEngine();
        engine.rt = rt;
        engine.format = format;
        engine.prompter = prompter;
        engine.activeLocale = defaultLocale;
        return engine;
    }

    public void Start()
    {
    }
}
`;

describe("export transpile smoke", () => {
  it("transpiles generated engine Cito to cs, py, and java", async (ctx) => {
    if (!isCitoCliAvailable()) {
      ctx.skip();
    }

    const project = makeRichExportProject();
    const ciSource = generateMuseLabEngineCi({
      project,
      promptsByLocale: createEmptyPromptsByLocale(project.locales),
    });

    const tmpDir = path.join(process.cwd(), "tmp", "export-transpile-test");
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, "generated.ci"), ciSource, "utf8");

    for (const target of ["cs", "py", "java"] as const) {
      const output = await transpileCiWithCli(ciSource, target);
      expect(output.length).toBeGreaterThan(0);
      assertRichEngineTranspileOutput(output, target);
    }
  }, 120_000);

  it("transpiles minimal fixture Cito to all export targets", async (ctx) => {
    if (!isCitoCliAvailable()) {
      ctx.skip();
    }

    for (const target of ["cs", "py", "java"] as const) {
      const output = await transpileCiWithCli(FIXTURE_CI, target);
      expect(output).toContain("MuseLabEngine");
    }
  }, 120_000);
});
