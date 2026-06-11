import { describe, expect, it } from "vitest";
import { createStarterProject, addNode, addEdge, updateNode, getFirstStoryId } from "../model/project";
import { migrateProjectBundle } from "../model/projectBundle";
import {
  setEdgeOptionText,
  setNodeSpeaker,
  setNodeTextTemplate,
  createEmptyPromptsByLocale,
} from "../locale/prompts";
import { isSceneNode } from "../model/nodeTypes";
import { getNodeDisplayName } from "../model/nodeNames";
import { exportStoryScript } from "./exportScript";
import { importStoryScript } from "./importScript";
import { parseScriptText, serializeScriptYaml } from "./parseScript";
import type { MuseLabStoryScript } from "./types";

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
    backdropId,
    actorConfigs: [
      {
        assetId: actorId,
        expressionId: exprId,
        attributes: { x: { type: "number", value: 12.5 } },
      },
    ],
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

  const promptsByLocale = createEmptyPromptsByLocale(project.locales);
  const en = promptsByLocale.en;
  setNodeTextTemplate(en, storyId, opening.id, "<p>Rain.</p>");
  setNodeSpeaker(en, storyId, opening.id, "Maya");
  setEdgeOptionText(en, storyId, edge.id, "Go to the alley");

  return migrateProjectBundle(project, promptsByLocale);
}

describe("MuseLab script export/import", () => {
  it("exports a human-readable story script with attributes and paths", () => {
    const bundle = createScriptFixtureBundle();
    const storyId = getFirstStoryId(bundle.project);
    const script = exportStoryScript(bundle, storyId);

    expect(script.story_name).toBe("Main");
    expect(script.entry_node_name).toBe("Opening");
    expect(script.attributes?.chapter).toEqual({ type: "integer", value: 1 });

    const opening = script.scenes.find((scene) => scene.node_name === "Opening");
    expect(opening?.backdrop?.backdrop_path).toBe("backgrounds/RainyStreet");
    expect(opening?.actors?.[0]?.actor_path).toBe("cast/Maya");
    expect(opening?.actors?.[0]?.expression).toBe("happy");
    expect(opening?.actors?.[0]?.attributes?.x).toEqual({ type: "number", value: 12.5 });
    expect(opening?.sound?.sound_path).toBe("music/AmbientRain");
    expect(opening?.options?.[0]?.condition).toBe('rt.GetBool("hasKey")');
    expect(opening?.options?.[0]?.attributes?.style).toEqual({
      type: "string",
      value: "dashed",
    });
  });

  it("round-trips export -> import (merge) preserving prompts and graph", () => {
    const bundle = createScriptFixtureBundle();
    const storyId = getFirstStoryId(bundle.project);
    const exported = exportStoryScript(bundle, storyId);
    const yaml = serializeScriptYaml(exported);
    const parsed = parseScriptText(yaml, "Main.mls.yaml") as MuseLabStoryScript;

    const working = structuredClone(bundle);
    importStoryScript(working, parsed, "merge", storyId);

    const story = working.project.stories[0];
    const opening = story.nodes.find(
      (node) => isSceneNode(node) && getNodeDisplayName(node) === "Opening"
    )!;
    const alley = story.nodes.find(
      (node) => isSceneNode(node) && getNodeDisplayName(node) === "Alley"
    )!;
    const edge = story.edges.find(
      (entry) => entry.sourceNodeId === opening.id && entry.targetNodeId === alley.id
    );

    expect(working.promptsByLocale.en.stories[storyId].nodes[opening.id].textTemplate).toBe(
      "<p>Rain.</p>"
    );
    expect(edge?.condition).toBe('rt.GetBool("hasKey")');
    expect(opening.attributes?.fade_in_ms).toEqual({ type: "integer", value: 300 });
  });

  it("maps on_click alias to edge condition on import", () => {
    const bundle = createScriptFixtureBundle();
    const storyId = getFirstStoryId(bundle.project);
    const script: MuseLabStoryScript = {
      format_version: 1,
      scenes: [
        {
          node_name: "Opening",
          options: [{ node_name: "Alley", on_click: "true" }],
        },
        { node_name: "Alley" },
      ],
      entry_node_name: "Opening",
    };

    importStoryScript(bundle, script, "replace", storyId);
    const story = bundle.project.stories[0];
    const opening = story.nodes.find(
      (node) => isSceneNode(node) && getNodeDisplayName(node) === "Opening"
    )!;
    const edge = story.edges.find((entry) => entry.sourceNodeId === opening.id);
    expect(edge?.condition).toBe("true");
  });

  it("fails import on invalid attribute types", () => {
    const bundle = createScriptFixtureBundle();
    const storyId = getFirstStoryId(bundle.project);
    const script: MuseLabStoryScript = {
      format_version: 1,
      attributes: {
        bad: { type: "integer", value: 1.5 },
      },
      scenes: [{ node_name: "Opening" }],
      entry_node_name: "Opening",
    };

    expect(() => importStoryScript(bundle, script, "merge", storyId)).toThrow(
      /integer value must be an integer/
    );
  });

  it("creates placeholder assets when script references missing project assets", () => {
    const bundle = createScriptFixtureBundle();
    const storyId = getFirstStoryId(bundle.project);
    const script: MuseLabStoryScript = {
      format_version: 1,
      scenes: [
        {
          node_name: "Opening",
          actors: [{ actor_path: "cast/Missing", expression: "happy" }],
          backdrop: { backdrop_path: "backgrounds/NewPlace" },
          sound: { sound_path: "music/NewTrack.wav" },
        },
      ],
      entry_node_name: "Opening",
    };

    const result = importStoryScript(bundle, script, "replace", storyId);
    expect(result.warnings.some((warning) => warning.includes("cast/Missing"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("backgrounds/NewPlace"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("music/NewTrack"))).toBe(true);

    const story = bundle.project.stories[0];
    const opening = story.nodes.find(
      (node) => isSceneNode(node) && getNodeDisplayName(node) === "Opening"
    )!;
    expect(opening.actorConfigs?.[0]?.assetId).toBeTruthy();
    expect(opening.backdropId).not.toBe("muselab-default-backdrop");
    expect(opening.soundConfigs?.[0]?.assetId).toBeTruthy();
  });

  it("creates missing story folders and stories from story_path + story_name", () => {
    const bundle = createScriptFixtureBundle();
    const script: MuseLabStoryScript = {
      format_version: 1,
      story_path: "Chapter2/Act1",
      story_name: "SideQuest",
      scenes: [{ node_name: "Opening" }],
      entry_node_name: "Opening",
    };

    const result = importStoryScript(bundle, script, "merge");
    expect(result.warnings.some((warning) => warning.includes('Added story folder "Chapter2"'))).toBe(
      true
    );
    expect(
      result.warnings.some((warning) => warning.includes('Added story folder "Chapter2/Act1"'))
    ).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('Added story "Chapter2/Act1/SideQuest"'))).toBe(
      true
    );

    const story = bundle.project.stories.find((entry) => entry.name === "SideQuest");
    expect(story).toBeTruthy();
    expect(
      bundle.project.storyGroups?.some(
        (group) => group.name === "Act1" && group.parentGroupId === bundle.project.storyGroups?.find((g) => g.name === "Chapter2")?.id
      )
    ).toBe(true);
  });
});
