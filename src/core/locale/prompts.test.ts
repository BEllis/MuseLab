import { describe, expect, it } from "vitest";
import { createEmptyProject, parseProject, serializeProject } from "../model/project";
import { migrateProjectBundle } from "../model/projectBundle";
import { getNodeTextTemplateForLocale, getEdgeOptionTextForLocale } from "./prompts";

describe("legacy prompt migration", () => {
  it("moves inline textTemplate and optionText into default locale prompts", () => {
    const raw = JSON.stringify({
      name: "Legacy",
      assets: [],
      nodes: [
        {
          id: "scene1",
          position: { x: 0, y: 0 },
          backdropId: "muselab-default-backdrop",
          actorIds: [],
          soundConfigs: [],
          textTemplate: "<p>Hello</p>",
        },
      ],
      edges: [
        {
          id: "edge1",
          sourceNodeId: "scene1",
          targetNodeId: "scene1",
          optionText: "Continue",
        },
      ],
      globalState: {},
    });

    const project = parseProject(raw);
    const bundle = migrateProjectBundle(project);

    expect(bundle.project.locales).toEqual(["en"]);
    expect(getNodeTextTemplateForLocale(bundle.promptsByLocale, "en", "scene1")).toBe("<p>Hello</p>");
    expect(getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", "edge1")).toBe("Continue");
    expect(serializeProject(bundle.project)).not.toContain("textTemplate");
    expect(serializeProject(bundle.project)).not.toContain("optionText");
  });
});

describe("project locales", () => {
  it("defaults locales to en for new projects", () => {
    const project = createEmptyProject();
    expect(project.locales).toEqual(["en"]);
  });
});
