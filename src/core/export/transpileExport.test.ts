import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import type { Project } from "../model/types";
import { normalizeLocales } from "../locale/localeTag";
import { createEmptyPromptsByLocale } from "../locale/prompts";
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

function resolveCitoExecutable(): string | null {
  const candidates = [
    path.join(process.cwd(), "tools", "cito", "cito"),
    path.join(process.cwd(), "tools", "cito", "cito.dll"),
  ];
  if (existsSync(candidates[0])) return candidates[0];
  if (existsSync(candidates[1])) return "dotnet";
  return null;
}

async function transpileWithCli(ciSource: string, outputPath: string): Promise<void> {
  const executable = resolveCitoExecutable();
  if (!executable) {
    throw new Error("cito CLI not built");
  }

  const tmpDir = path.join(process.cwd(), "tmp", "export-transpile-test");
  await mkdir(tmpDir, { recursive: true });
  const ciPath = path.join(tmpDir, "fixture.ci");
  await writeFile(ciPath, ciSource, "utf8");

  const args =
    executable === "dotnet"
      ? [path.join(process.cwd(), "tools", "cito", "cito.dll"), "-o", outputPath, ciPath]
      : ["-o", outputPath, ciPath];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `cito exited with code ${code}`));
    });
  });
}

describe("export transpile smoke", () => {
  it("transpiles generated engine Cito to cs, py, and java", async () => {
    const executable = resolveCitoExecutable();
    if (!executable) {
      return;
    }

    const project: Project = {
      name: "Smoke",
      assets: [],
      locales: normalizeLocales(["en"]),
      modules: [],
      stories: [
        {
          id: "story-1",
          name: "Main",
          entryNodeId: "start-1",
          globalState: {},
          nodes: [{ id: "start-1", type: "start", position: { x: 0, y: 0 } }],
          edges: [],
        },
      ],
    };
    const ciSource = generateMuseLabEngineCi({
      project,
      promptsByLocale: createEmptyPromptsByLocale(project.locales),
    });

    const tmpDir = path.join(process.cwd(), "tmp", "export-transpile-test");
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, "generated.ci"), ciSource, "utf8");

    for (const [, fileName] of [
      ["cs", "MuseLabEngine.cs"],
      ["py", "MuseLabEngine.py"],
      ["java", "MuseLabEngine.java"],
    ] as const) {
      const outputPath = path.join(tmpDir, fileName);
      await transpileWithCli(ciSource, outputPath);
      const output = await readFile(outputPath, "utf8");
      expect(output.length).toBeGreaterThan(0);
      expect(output).toContain("MuseLabEngine");
    }
  }, 60_000);

  it("transpiles minimal fixture Cito to all export targets", async () => {
    const executable = resolveCitoExecutable();
    if (!executable) {
      return;
    }

    const tmpDir = path.join(process.cwd(), "tmp", "export-transpile-test");
    await mkdir(tmpDir, { recursive: true });

    for (const fileName of ["fixture.cs", "fixture.py", "MuseLabEngine.java"]) {
      const outputPath = path.join(tmpDir, fileName);
      await transpileWithCli(FIXTURE_CI, outputPath);
      const output = await readFile(outputPath, "utf8");
      expect(output).toContain("MuseLabEngine");
    }
  }, 30_000);
});
