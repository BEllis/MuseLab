import { describe, expect, it } from "vitest";
import { createEmptyProject, parseProject, getFirstStoryId } from "../model/project";
import { migrateProjectBundle } from "../model/projectBundle";
import {
  cloneNodePrompts,
  createEmptyLocalePrompts,
  getEdgeOptionTextForLocale,
  getNodeActionsForLocale,
  parseLocalePrompts,
  serializeLocalePrompts,
  renameLocaleInPrompts,
  setEdgeOptionText,
  setNodeActions,
} from "./prompts";
import type { SceneAction } from "../scene/actions";

describe("legacy manifest migration", () => {
  it("wraps a legacy flat manifest into a single story with empty prompts", () => {
    const raw = JSON.stringify({
      name: "Legacy",
      assets: [],
      nodes: [
        {
          id: "scene1",
          position: { x: 0, y: 0 },
        },
      ],
      edges: [
        {
          id: "edge1",
          sourceNodeId: "scene1",
          targetNodeId: "scene1",
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
    expect(getNodeActionsForLocale(bundle.promptsByLocale, "en", storyId, sceneId)).toEqual([]);
    expect(
      getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", storyId, edgeId)
    ).toBeUndefined();
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
    const actions: SceneAction[] = [{ kind: "dialogue.setSpeaker", text: "Hi" }];
    const promptsByLocale = {
      en: {
        stories: {
          story1: {
            nodes: { n1: { actions } },
            edges: {},
          },
        },
      },
    };

    const renamed = renameLocaleInPrompts(promptsByLocale, "en", "en-gb");
    expect(renamed.en).toBeUndefined();
    expect(renamed["en-gb"]?.stories.story1?.nodes.n1?.actions).toEqual(actions);
  });
});

describe("node actions", () => {
  const storyId = "story1";

  it("removes the node entry when actions are cleared", () => {
    const prompts = createEmptyLocalePrompts();
    setNodeActions(prompts, storyId, "n1", [{ kind: "dialogue.setSpeaker", text: "Maya" }]);
    expect(prompts.stories[storyId]?.nodes.n1).toEqual({
      actions: [{ kind: "dialogue.setSpeaker", text: "Maya" }],
    });

    setNodeActions(prompts, storyId, "n1", []);
    expect(prompts.stories[storyId]?.nodes.n1).toBeUndefined();
  });

  it("serializes and parses actions", () => {
    const prompts = createEmptyLocalePrompts();
    const actions: SceneAction[] = [
      { kind: "dialogue.setSpeaker", text: "Alex" },
      { kind: "dialogue.revealText", text: "Hi", reveal: { mode: "instant" } },
    ];
    setNodeActions(prompts, storyId, "n1", actions);
    setEdgeOptionText(prompts, storyId, "e1", "Continue");

    const json = serializeLocalePrompts(prompts);
    const parsed = parseLocalePrompts(json);

    expect(parsed.stories[storyId]?.nodes.n1?.actions).toEqual(actions);
    expect(parsed.stories[storyId]?.edges.e1?.optionText).toBe("Continue");
  });

  it("clones actions between nodes", () => {
    const promptsByLocale = { en: createEmptyLocalePrompts() };
    const actions: SceneAction[] = [{ kind: "dialogue.setSpeaker", text: "Maya" }];
    setNodeActions(promptsByLocale.en, storyId, "src", actions);

    cloneNodePrompts(promptsByLocale, storyId, "src", "dst");

    expect(getNodeActionsForLocale(promptsByLocale, "en", storyId, "dst")).toEqual(actions);
  });
});
