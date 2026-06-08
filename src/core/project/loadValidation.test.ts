import { describe, expect, it } from "vitest";
import { createEmptyLocalePrompts } from "../locale/prompts";
import { createStarterProject } from "../model/project";
import { packProjectArchive, unpackProjectArchive } from "./projectArchive";
import { validateStoredProjectJson, validateUnpackedArchive } from "./loadValidation";

describe("loadValidation", () => {
  it("reports legacy warnings for old bundle payloads", () => {
    const warnings = validateStoredProjectJson(
      JSON.stringify({
        project: {
          name: "Legacy",
          assets: [],
          stories: [
            {
              id: "main",
              name: "Main",
              nodes: [],
              edges: [],
              globalState: {},
            },
          ],
          locales: ["en"],
        },
        promptsByLocale: {
          en: {
            stories: {
              main: { nodes: {}, edges: {} },
            },
          },
        },
      })
    );

    expect(warnings.some((warning) => warning.includes("Missing formatVersion"))).toBe(true);
  });

  it("does not warn about formatVersion for freshly saved mlvn archives", async () => {
    const project = createStarterProject("Round trip");
    const archive = await packProjectArchive({
      project,
      promptsByLocale: { en: createEmptyLocalePrompts() },
    });
    const unpacked = unpackProjectArchive(archive);

    expect(validateUnpackedArchive(unpacked)).toEqual([]);
  });
});
