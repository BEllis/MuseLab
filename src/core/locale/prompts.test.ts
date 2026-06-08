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

    expect(bundle.project.locales).toEqual(["en"]);
    expect(
      getNodeTextTemplateForLocale(bundle.promptsByLocale, "en", storyId, "scene1")
    ).toBe("<p>Hello</p>");
    expect(getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", storyId, "edge1")).toBe(
      "Continue"
    );
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
