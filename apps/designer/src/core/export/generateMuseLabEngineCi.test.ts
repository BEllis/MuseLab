import { describe, expect, it } from "vitest";
import type { Project } from "../model/types";
import { normalizeLocales } from "../locale/localeTag";
import { createEmptyPromptsByLocale } from "../locale/prompts";
import { generateMuseLabEngineCi } from "./generateMuseLabEngineCi";

function makeExportProject(): Project {
  return {
    name: "Export Test",
    assets: [],
    locales: normalizeLocales(["en"]),
    modules: [],
    storyGroups: [{ id: "group-1", name: "Chapter1" }],
    stories: [
      {
        id: "story-1",
        name: "Main",
        groupId: "group-1",
        entryNodeId: "start-1",
        globalState: { metGuide: true },
        nodes: [
          { id: "start-1", type: "start", position: { x: 0, y: 0 }, label: "Intro" },
          {
            id: "scene-1",
            type: "scene",
            position: { x: 100, y: 0 },
            backdropId: "bg-1",
          },
        ],
        edges: [{ id: "edge-1", sourceNodeId: "start-1", targetNodeId: "scene-1" }],
      },
    ],
  };
}

describe("generateMuseLabEngineCi", () => {
  it("generates module interfaces, project data, and MuseLabEngine entry points", () => {
    const project = makeExportProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    promptsByLocale.en.stories["story-1"] = {
      nodes: {
        "scene-1": { textTemplate: "Hello @rt.GetString(\"name\")" },
      },
      edges: {},
    };

    const ci = generateMuseLabEngineCi({ project, promptsByLocale });

    expect(ci).toContain("public abstract class IMuseLabRuntime");
    expect(ci).toContain("public abstract class IMuseLabFormat");
    expect(ci).toContain("public abstract class IMuseLabPromptRenderer");
    expect(ci).toContain("public static class MuseLabProjectData");
    expect(ci).toContain("public class MuseLabEngine");
    expect(ci).toContain("public static MuseLabEngine# Create(");
    expect(ci).toContain("public void Start()");
    expect(ci).toContain("public void StartStoryById(string storyId)");
    expect(ci).toContain("public void StartStoryByIdAtNode(string storyId, string startNodeId)");
    expect(ci).toContain("public void StartStoryByPath(string groupPath, string storyName)");
    expect(ci).toContain("public void GoToNode(string nodeId)");
    expect(ci).toContain("public RuntimeState# GetRuntimeState()");
    expect(ci).toContain('rt.SetBool("metGuide", true);');
    expect(ci).toContain("ApplyMissingStoryGlobalStateDefaults");
    expect(ci).toContain("public abstract bool HasKey(string key);");
    expect(ci).toContain("public static class Template_");
  });

  it("compares edge index as int in GetOutgoingEdgeId", () => {
    const project = makeExportProject();
    project.stories[0].nodes.push({
      id: "scene-2",
      type: "scene",
      position: { x: 200, y: 0 },
    });
    project.stories[0].edges.push(
      { id: "edge-2", sourceNodeId: "start-1", targetNodeId: "scene-2" },
      { id: "edge-3", sourceNodeId: "start-1", targetNodeId: "scene-1" }
    );

    const ci = generateMuseLabEngineCi({
      project,
      promptsByLocale: createEmptyPromptsByLocale(project.locales),
    });

    expect(ci).toContain("if (index == 0)");
    expect(ci).toContain("if (index == 1)");
    expect(ci).not.toMatch(/if \(index == "[0-9]+"\)/);
  });

  it("emits jump target lookups and per-story missing global state defaults", () => {
    const project = makeExportProject();
    project.stories.push({
      id: "story-2",
      name: "Side",
      entryNodeId: "start-2",
      globalState: { trust: 0 },
      nodes: [
        { id: "start-2", type: "start", position: { x: 0, y: 0 }, label: "Side" },
        {
          id: "jump-1",
          type: "jump",
          position: { x: 100, y: 0 },
          jumpTargetStoryId: "story-2",
          jumpTargetStartNodeId: "start-2",
        },
      ],
      edges: [{ id: "edge-jump", sourceNodeId: "start-2", targetNodeId: "jump-1" }],
    });

    const ci = generateMuseLabEngineCi({
      project,
      promptsByLocale: createEmptyPromptsByLocale(project.locales),
    });

    expect(ci).toContain("GetJumpTargetStoryId");
    expect(ci).toContain("GetJumpTargetStartNodeId");
    expect(ci).toContain('rt.SetInt("trust", 0);');
    expect(ci).toContain("ApplyMissingStoryGlobalStateDefaults");
  });
});
