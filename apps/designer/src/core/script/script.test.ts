import { describe, expect, it } from "vitest";
import { createStarterProject, addNode, addEdge, updateNode, getFirstStoryId } from "../model/project";
import { migrateProjectBundle } from "../model/projectBundle";
import {
  setEdgeOptionText,
  setNodeActions,
  createEmptyPromptsByLocale,
  getNodeActionsForLocale,
} from "../locale/prompts";
import { isSceneNode } from "../model/nodeTypes";
import { getNodeDisplayName } from "../model/nodeNames";
import { exportStoryScript } from "./exportScript";
import { importStoryScript } from "./importScript";
import { parseScriptText, serializeScriptYaml } from "./parseScript";
import type { MuseLabStoryScript } from "./types";
import type { SceneAction } from "../scene/actions";

function createScriptFixtureBundle() {
  const project = createStarterProject("Script Test");
  const storyId = getFirstStoryId(project);

  project.assetGroups = [
    { id: "grp-cast", name: "cast", assetType: "actor" },
    { id: "grp-bg", name: "backgrounds", assetType: "backdrop" },
    { id: "grp-music", name: "music", assetType: "sound" },
  ];

  const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const backdropId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const soundId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const exprId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  project.assets.push(
    {
      id: actorId,
      type: "actor",
      name: "Maya",
      groupId: "grp-cast",
      expressions: [{ id: exprId, name: "happy" }],
      defaultExpressionId: exprId,
    },
    {
      id: backdropId,
      type: "backdrop",
      name: "RainyStreet",
      groupId: "grp-bg",
    },
    {
      id: soundId,
      type: "sound",
      name: "AmbientRain",
      groupId: "grp-music",
    }
  );

  const story = project.stories[0];
  story.attributes = {
    chapter: { type: "integer", value: 1 },
  };

  const opening = addNode(project, storyId, { x: 300, y: 100 }, "scene");
  updateNode(project, storyId, opening.id, {
    label: "Opening",
    soundConfigs: [
      {
        assetId: soundId,
        startOnLoad: true,
        attributes: { fade: { type: "number", value: 0.5 } },
      },
    ],
    attributes: {
      fade_in_ms: { type: "integer", value: 300 },
    },
  });

  const alley = addNode(project, storyId, { x: 560, y: 100 }, "scene");
  updateNode(project, storyId, alley.id, { label: "Alley" });

  const startNode = story.nodes.find((node) => node.type === "start")!;
  addEdge(project, storyId, startNode.id, opening.id);
  const edge = addEdge(project, storyId, opening.id, alley.id, {
    condition: 'rt.GetBool("hasKey")',
  });
  edge.attributes = {
    style: { type: "string", value: "dashed" },
  };

  const openingActions: SceneAction[] = [
    { kind: "bg.show", assetId: backdropId },
    { kind: "prop.add", id: "maya", assetId: actorId, variationId: exprId },
    { kind: "prop.show", id: "maya", position: { kind: "slot", slot: "Left" } },
    { kind: "dialogue.setSpeaker", text: "Maya" },
    {
      kind: "dialogue.revealText",
      text: "Rain.",
      reveal: { mode: "instant" },
    },
    { kind: "waitForContinue" },
  ];

  const promptsByLocale = createEmptyPromptsByLocale(project.locales);
  const en = promptsByLocale.en;
  setNodeActions(en, storyId, opening.id, openingActions);
  setEdgeOptionText(en, storyId, edge.id, "Go to the alley");

  return migrateProjectBundle(project, promptsByLocale);
}

describe("script export/import", () => {
  it("exports scene actions per locale", () => {
    const bundle = createScriptFixtureBundle();
    const script = exportStoryScript(bundle, getFirstStoryId(bundle.project));
    const opening = script.scenes.find((scene) => scene.node_name === "Opening");
    expect(opening?.actions?.en).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "bg.show" }),
        expect.objectContaining({ kind: "dialogue.setSpeaker", text: "Maya" }),
        expect.objectContaining({ kind: "dialogue.revealText", text: "Rain." }),
      ])
    );
    expect(opening?.sound?.sound_path).toBe("music/AmbientRain");
  });

  it("round-trips actions through YAML", () => {
    const bundle = createScriptFixtureBundle();
    const storyId = getFirstStoryId(bundle.project);
    const script = exportStoryScript(bundle, storyId);
    const yaml = serializeScriptYaml(script);
    const parsed = parseScriptText(yaml) as MuseLabStoryScript;

    const target = createStarterProject("Import Target");
    const working = migrateProjectBundle(
      target,
      createEmptyPromptsByLocale(target.locales)
    );

    // Seed assets the script actions reference by id.
    const source = createScriptFixtureBundle();
    working.project.assets.push(
      ...source.project.assets.filter((a) => a.id !== "muselab-default-backdrop")
    );

    const result = importStoryScript(working, parsed, "replace");
    const importedStoryId = getFirstStoryId(result.bundle.project);
    const opening = result.bundle.project.stories[0].nodes.find(
      (node) => isSceneNode(node) && getNodeDisplayName(node, result.bundle.project) === "Opening"
    );
    expect(opening).toBeTruthy();
    const actions = getNodeActionsForLocale(
      result.bundle.promptsByLocale,
      "en",
      importedStoryId,
      opening!.id
    );
    expect(actions.some((action) => action.kind === "bg.show")).toBe(true);
    expect(actions.some((action) => action.kind === "dialogue.revealText")).toBe(true);
  });
});
