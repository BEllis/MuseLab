import { describe, expect, it } from "vitest";
import { validateStoredProjectJson } from "./loadValidation";

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
});
