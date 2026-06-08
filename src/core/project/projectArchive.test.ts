import { describe, expect, it } from "vitest";
import {
  createStarterProject,
  parseProject,
  getFirstStoryId,
  getStory,
  addNode,
  addStory,
} from "../model/project";
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
    const storyId = getFirstStoryId(project);
    const nodeId = getStory(project, storyId).nodes[0]!.id;

    const promptsByLocale = {
      en: createEmptyLocalePrompts(),
      de: createEmptyLocalePrompts(),
    };
    setNodeTextTemplate(promptsByLocale.en, storyId, nodeId, "<p>Hello</p>");
    setNodeTextTemplate(promptsByLocale.de, storyId, nodeId, "<p>Hallo</p>");

    const archive = await packProjectArchive({ project, promptsByLocale });
    const unpacked = unpackProjectArchive(archive);
    expect(unpacked.metadata).toMatchObject({
      formatVersion: 1,
      schema: "https://muselab.dev/schemas/mlvn.schema.json",
      manifest: "project.json",
    });
    const bundle = migrateProjectBundle(
      parseProject(unpacked.manifest),
      Object.fromEntries(unpacked.prompts.entries())
    );
    const restoredStoryId = getFirstStoryId(bundle.project);

    expect(bundle.project.locales).toEqual(["en", "de"]);
    expect(
      getNodeTextTemplateForLocale(bundle.promptsByLocale, "en", restoredStoryId, nodeId)
    ).toBe("<p>Hello</p>");
    expect(
      getNodeTextTemplateForLocale(bundle.promptsByLocale, "de", restoredStoryId, nodeId)
    ).toBe("<p>Hallo</p>");
  });

  it("preserves edge option text per locale", async () => {
    const project = createStarterProject("Choices");
    project.locales = ["en", "de"];
    const storyId = getFirstStoryId(project);
    const story = getStory(project, storyId);
    const sourceId = story.nodes[0]!.id;
    addNode(project, storyId, { x: 400, y: 100 });
    const targetId = story.nodes[1]!.id;
    story.edges.push({
      id: "edge1",
      sourceNodeId: sourceId,
      targetNodeId: targetId,
    });

    const promptsByLocale = {
      en: createEmptyLocalePrompts(),
      de: createEmptyLocalePrompts(),
    };
    setEdgeOptionText(promptsByLocale.en, storyId, "edge1", "Go on");
    setEdgeOptionText(promptsByLocale.de, storyId, "edge1", "Weiter");

    const archive = await packProjectArchive({ project, promptsByLocale });
    const unpacked = unpackProjectArchive(archive);
    const bundle = migrateProjectBundle(
      parseProject(unpacked.manifest),
      Object.fromEntries(unpacked.prompts.entries())
    );
    const restoredStoryId = getFirstStoryId(bundle.project);

    expect(
      getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", restoredStoryId, "edge1")
    ).toBe("Go on");
    expect(
      getEdgeOptionTextForLocale(bundle.promptsByLocale, "de", restoredStoryId, "edge1")
    ).toBe("Weiter");
  });

  it("round-trips multiple stories", async () => {
    const project = createStarterProject("Multi");
    addStory(project, "Branch B");
    const [firstStory, secondStory] = project.stories;
    expect(firstStory).toBeDefined();
    expect(secondStory).toBeDefined();

    const promptsByLocale = { en: createEmptyLocalePrompts() };
    setNodeTextTemplate(
      promptsByLocale.en,
      firstStory!.id,
      firstStory!.nodes[0]!.id,
      "<p>First</p>"
    );
    setNodeTextTemplate(
      promptsByLocale.en,
      secondStory!.id,
      secondStory!.nodes[0]!.id,
      "<p>Second</p>"
    );

    const archive = await packProjectArchive({ project, promptsByLocale });
    const unpacked = unpackProjectArchive(archive);
    const bundle = migrateProjectBundle(
      parseProject(unpacked.manifest),
      Object.fromEntries(unpacked.prompts.entries())
    );

    expect(bundle.project.stories).toHaveLength(2);
    const restoredFirst = bundle.project.stories[0]!;
    const restoredSecond = bundle.project.stories[1]!;
    expect(
      getNodeTextTemplateForLocale(
        bundle.promptsByLocale,
        "en",
        restoredFirst.id,
        restoredFirst.nodes[0]!.id
      )
    ).toBe("<p>First</p>");
    expect(
      getNodeTextTemplateForLocale(
        bundle.promptsByLocale,
        "en",
        restoredSecond.id,
        restoredSecond.nodes[0]!.id
      )
    ).toBe("<p>Second</p>");
  });
});
