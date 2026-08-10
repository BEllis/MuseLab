import { describe, expect, it } from "vitest";
import {
  createStarterProject,
  parseProject,
  getFirstStoryId,
  getStory,
  addNode,
  addStory,
  addBlankActor,
  addActorExpression,
} from "../model/project";
import { PLACEHOLDER_EXPRESSION_URL } from "../assets/actorExpressions";
import { migrateProjectBundle } from "../model/projectBundle";
import {
  getEdgeOptionTextForLocale,
  getNodeActionsForLocale,
  setEdgeOptionText,
  setNodeActions,
  createEmptyLocalePrompts,
} from "../locale/prompts";
import { getLocaleTags, normalizeLocales } from "../locale/localeTag";
import { packProjectArchive, unpackProjectArchive } from "../project/projectArchive";
import { MUSELAB_FORMAT_VERSION } from "../model/formatVersion";

describe("projectArchive localization", () => {
  it("round-trips prompts files in mlvn archives", async () => {
    const project = createStarterProject("Localized");
    project.locales = normalizeLocales(["en", "de"]);
    project.defaultLocale = "en";
    const storyId = getFirstStoryId(project);
    const nodeId = getStory(project, storyId).nodes[0]!.id;

    const promptsByLocale = {
      en: createEmptyLocalePrompts(),
      de: createEmptyLocalePrompts(),
    };
    setNodeActions(promptsByLocale.en, storyId, nodeId, [
      { kind: "dialogue.revealText", channel: "main", text: "Hello", reveal: { mode: "instant" } },
    ]);
    setNodeActions(promptsByLocale.de, storyId, nodeId, [
      { kind: "dialogue.revealText", channel: "main", text: "Hallo", reveal: { mode: "instant" } },
    ]);

    const archive = await packProjectArchive({ project, promptsByLocale });
    const unpacked = unpackProjectArchive(archive);
    expect(unpacked.metadata).toMatchObject({
      formatVersion: MUSELAB_FORMAT_VERSION,
      schema: "https://muselab.dev/schemas/mlvn.schema.json",
      manifest: "project.json",
    });
    const bundle = migrateProjectBundle(
      parseProject(unpacked.manifest),
      Object.fromEntries(unpacked.prompts.entries())
    );
    const restoredStoryId = getFirstStoryId(bundle.project);

    expect(getLocaleTags(bundle.project.locales)).toEqual(["de", "en"]);
    expect(bundle.project.defaultLocale).toBe("en");
    expect(
      getNodeActionsForLocale(bundle.promptsByLocale, "en", restoredStoryId, nodeId)
    ).toEqual([
      { kind: "dialogue.revealText", channel: "main", text: "Hello", reveal: { mode: "instant" } },
    ]);
    expect(
      getNodeActionsForLocale(bundle.promptsByLocale, "de", restoredStoryId, nodeId)
    ).toEqual([
      { kind: "dialogue.revealText", channel: "main", text: "Hallo", reveal: { mode: "instant" } },
    ]);
  });

  it("preserves edge option text per locale", async () => {
    const project = createStarterProject("Choices");
    project.locales = normalizeLocales(["en", "de"]);
    project.defaultLocale = "en";
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
    const restoredEdgeId = getStory(bundle.project, restoredStoryId).edges[0]!.id;

    expect(
      getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", restoredStoryId, restoredEdgeId)
    ).toBe("Go on");
    expect(
      getEdgeOptionTextForLocale(bundle.promptsByLocale, "de", restoredStoryId, restoredEdgeId)
    ).toBe("Weiter");
  });

  it("round-trips multiple stories", async () => {
    const project = createStarterProject("Multi");
    addStory(project, "Branch B");
    const [firstStory, secondStory] = project.stories;
    expect(firstStory).toBeDefined();
    expect(secondStory).toBeDefined();

    const promptsByLocale = { en: createEmptyLocalePrompts() };
    setNodeActions(promptsByLocale.en, firstStory!.id, firstStory!.nodes[0]!.id, [
      { kind: "dialogue.revealText", channel: "main", text: "First", reveal: { mode: "instant" } },
    ]);
    setNodeActions(promptsByLocale.en, secondStory!.id, secondStory!.nodes[0]!.id, [
      { kind: "dialogue.revealText", channel: "main", text: "Second", reveal: { mode: "instant" } },
    ]);

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
      getNodeActionsForLocale(
        bundle.promptsByLocale,
        "en",
        restoredFirst.id,
        restoredFirst.nodes[0]!.id
      )
    ).toEqual([
      { kind: "dialogue.revealText", channel: "main", text: "First", reveal: { mode: "instant" } },
    ]);
    expect(
      getNodeActionsForLocale(
        bundle.promptsByLocale,
        "en",
        restoredSecond.id,
        restoredSecond.nodes[0]!.id
      )
    ).toEqual([
      { kind: "dialogue.revealText", channel: "main", text: "Second", reveal: { mode: "instant" } },
    ]);
  });

  it("round-trips actor expressions in mlvn archives", async () => {
    const project = createStarterProject("Actors");
    const actor = addBlankActor(project, "Hero");
    const happy = addActorExpression(project, actor.id, "happy");
    actor.expressions![0].url = PLACEHOLDER_EXPRESSION_URL;

    const storyId = getFirstStoryId(project);
    const scene = addNode(project, storyId, { x: 300, y: 100 }, "scene");
    const promptsByLocale = { en: createEmptyLocalePrompts() };
    setNodeActions(promptsByLocale.en, storyId, scene.id, [
      { kind: "prop.add", id: "hero", assetId: actor.id, variationId: actor.expressions![0].id },
      { kind: "prop.setVariation", id: "hero", variationId: happy.id },
    ]);

    const archive = await packProjectArchive({
      project,
      promptsByLocale,
    });
    const unpacked = unpackProjectArchive(archive);
    const bundle = migrateProjectBundle(parseProject(unpacked.manifest));

    const restoredActor = bundle.project.assets.find((asset) => asset.id === actor.id);
    expect(restoredActor?.expressions).toHaveLength(2);
    expect(restoredActor?.expressions?.map((expression) => expression.name).sort()).toEqual([
      "default",
      "happy",
    ]);
  });
});
