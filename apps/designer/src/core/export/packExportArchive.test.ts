import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type { Project } from "../model/types";
import { normalizeLocales } from "../locale/localeTag";
import { createEmptyPromptsByLocale } from "../locale/prompts";
import { exportArchiveFileName, packExportArchive } from "./packExportArchive";

function makeProject(): Project {
  return {
    name: "Zip Test",
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
}

describe("packExportArchive", () => {
  it("includes transpiled output, cito source, project archive files, and README", async () => {
    const project = makeProject();
    const bundle = { project, promptsByLocale: createEmptyPromptsByLocale(project.locales) };
    const archive = await packExportArchive(
      bundle,
      "public class MuseLabEngine {}",
      "// generated cs",
      "cs"
    );

    const entries = unzipSync(archive);
    expect(entries["MuseLabEngine.cs"]).toBeDefined();
    expect(strFromU8(entries["MuseLabEngine.cs"])).toBe("// generated cs");
    expect(entries["cito/MuseLabEngine.ci"]).toBeDefined();
    expect(entries["README.md"]).toBeDefined();
    expect(entries["project.json"]).toBeDefined();
    expect(entries["prompts.en.json"]).toBeDefined();
  });

  it("builds a safe archive filename", () => {
    expect(exportArchiveFileName("My Game!", "py")).toBe("My_Game-py-export.zip");
  });
});
