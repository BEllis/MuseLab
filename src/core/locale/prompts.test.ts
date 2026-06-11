import { describe, expect, it } from "vitest";
import { createEmptyProject, parseProject, serializeProject, getFirstStoryId } from "../model/project";
import { migrateProjectBundle } from "../model/projectBundle";
import {
  cloneNodePrompts,
  createEmptyLocalePrompts,
  getNodeSpeakerForLocale,
  getNodeTextTemplateForLocale,
  getEdgeOptionTextForLocale,
  parseLocalePrompts,
  serializeLocalePrompts,
  renameLocaleInPrompts,
  setNodeSpeaker,
  setNodeTextTemplate,
} from "./prompts";

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
          actorConfigs: [],
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
    const storyId = getFirstStoryId(bundle.project);
    const sceneId = bundle.project.stories[0]!.nodes[0]!.id;
    const edgeId = bundle.project.stories[0]!.edges[0]!.id;

    expect(bundle.project.locales[0]).toMatchObject({ locale: "en", displayName: "en" });
    expect(
      getNodeTextTemplateForLocale(bundle.promptsByLocale, "en", storyId, sceneId)
    ).toBe("<p>Hello</p>");
    expect(getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", storyId, edgeId)).toBe(
      "Continue"
    );
    expect(serializeProject(bundle.project)).not.toContain("textTemplate");
    expect(serializeProject(bundle.project)).not.toContain("optionText");
  });
});

describe("project locales", () => {
  it("defaults locales to en for new projects", () => {
    const project = createEmptyProject();
    expect(project.locales[0]).toMatchObject({ locale: "en", displayName: "en" });
  });
});

describe("renameLocaleInPrompts", () => {
  it("moves prompt data when a locale code changes", () => {
    const promptsByLocale = {
      en: {
        stories: {
          story1: {
            nodes: { n1: { textTemplate: "<p>Hi</p>" } },
            edges: {},
          },
        },
      },
    };

    const renamed = renameLocaleInPrompts(promptsByLocale, "en", "en-gb");
    expect(renamed.en).toBeUndefined();
    expect(renamed["en-gb"]?.stories.story1?.nodes.n1?.textTemplate).toBe("<p>Hi</p>");
  });
});

describe("node speaker", () => {
  const storyId = "story1";

  it("preserves speaker when clearing textTemplate", () => {
    const prompts = createEmptyLocalePrompts();
    setNodeTextTemplate(prompts, storyId, "n1", "<p>Hello</p>");
    setNodeSpeaker(prompts, storyId, "n1", "Maya");
    setNodeTextTemplate(prompts, storyId, "n1", "");

    expect(prompts.stories[storyId]?.nodes.n1).toEqual({ speaker: "Maya" });
  });

  it("preserves textTemplate when clearing speaker", () => {
    const prompts = createEmptyLocalePrompts();
    setNodeTextTemplate(prompts, storyId, "n1", "<p>Hello</p>");
    setNodeSpeaker(prompts, storyId, "n1", "Maya");
    setNodeSpeaker(prompts, storyId, "n1", "");

    expect(prompts.stories[storyId]?.nodes.n1).toEqual({ textTemplate: "<p>Hello</p>" });
  });

  it("removes node entry when both fields are cleared", () => {
    const prompts = createEmptyLocalePrompts();
    setNodeTextTemplate(prompts, storyId, "n1", "<p>Hello</p>");
    setNodeSpeaker(prompts, storyId, "n1", "Maya");
    setNodeTextTemplate(prompts, storyId, "n1", "");
    setNodeSpeaker(prompts, storyId, "n1", "");

    expect(prompts.stories[storyId]?.nodes.n1).toBeUndefined();
  });

  it("serializes and parses speaker with textTemplate", () => {
    const prompts = createEmptyLocalePrompts();
    setNodeTextTemplate(prompts, storyId, "n1", "<p>Hi</p>");
    setNodeSpeaker(prompts, storyId, "n1", "Alex");
    setNodeSpeaker(prompts, storyId, "n2", "Narrator");

    const json = serializeLocalePrompts(prompts);
    const parsed = parseLocalePrompts(json);

    expect(parsed.stories[storyId]?.nodes.n1).toEqual({
      textTemplate: "<p>Hi</p>",
      speaker: "Alex",
    });
    expect(parsed.stories[storyId]?.nodes.n2).toEqual({ speaker: "Narrator" });
  });

  it("clones both speaker and textTemplate", () => {
    const promptsByLocale = { en: createEmptyLocalePrompts() };
    setNodeTextTemplate(promptsByLocale.en, storyId, "src", "<p>Line</p>");
    setNodeSpeaker(promptsByLocale.en, storyId, "src", "Maya");

    cloneNodePrompts(promptsByLocale, storyId, "src", "dst");

    expect(getNodeTextTemplateForLocale(promptsByLocale, "en", storyId, "dst")).toBe("<p>Line</p>");
    expect(getNodeSpeakerForLocale(promptsByLocale, "en", storyId, "dst")).toBe("Maya");
  });
});
