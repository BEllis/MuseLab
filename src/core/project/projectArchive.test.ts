import { describe, expect, it } from "vitest";
import { createStarterProject, parseProject } from "../model/project";
import { migrateProjectBundle } from "../model/projectBundle";
import {
  getEdgeOptionTextForLocale,
  getNodeTextTemplateForLocale,
  setEdgeOptionText,
  setNodeTextTemplate,
  createEmptyLocalePrompts,
} from "../locale/prompts";
import { packProjectArchive, unpackProjectArchive } from "../project/projectArchive";

describe("projectArchive localization", () => {
  it("round-trips prompts files in mlvn archives", async () => {
    const project = createStarterProject("Localized");
    project.locales = ["en", "de"];
    const nodeId = project.nodes[0]!.id;

    const promptsByLocale = {
      en: createEmptyLocalePrompts(),
      de: createEmptyLocalePrompts(),
    };
    setNodeTextTemplate(promptsByLocale.en, nodeId, "<p>Hello</p>");
    setNodeTextTemplate(promptsByLocale.de, nodeId, "<p>Hallo</p>");

    const archive = await packProjectArchive({ project, promptsByLocale });
    const unpacked = unpackProjectArchive(archive);
    const bundle = migrateProjectBundle(
      parseProject(unpacked.manifest),
      Object.fromEntries(unpacked.prompts.entries())
    );

    expect(bundle.project.locales).toEqual(["en", "de"]);
    expect(getNodeTextTemplateForLocale(bundle.promptsByLocale, "en", nodeId)).toBe("<p>Hello</p>");
    expect(getNodeTextTemplateForLocale(bundle.promptsByLocale, "de", nodeId)).toBe("<p>Hallo</p>");
  });

  it("preserves edge option text per locale", async () => {
    const project = createStarterProject("Choices");
    project.locales = ["en", "de"];
    const sourceId = project.nodes[0]!.id;
    project.nodes.push({
      id: "scene2",
      position: { x: 400, y: 100 },
      backdropId: project.nodes[0]!.backdropId,
      actorIds: [],
      soundConfigs: [],
    });
    project.edges.push({
      id: "edge1",
      sourceNodeId: sourceId,
      targetNodeId: "scene2",
    });

    const promptsByLocale = {
      en: createEmptyLocalePrompts(),
      de: createEmptyLocalePrompts(),
    };
    setEdgeOptionText(promptsByLocale.en, "edge1", "Go on");
    setEdgeOptionText(promptsByLocale.de, "edge1", "Weiter");

    const archive = await packProjectArchive({ project, promptsByLocale });
    const unpacked = unpackProjectArchive(archive);
    const bundle = migrateProjectBundle(
      parseProject(unpacked.manifest),
      Object.fromEntries(unpacked.prompts.entries())
    );

    expect(getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", "edge1")).toBe("Go on");
    expect(getEdgeOptionTextForLocale(bundle.promptsByLocale, "de", "edge1")).toBe("Weiter");
  });
});
