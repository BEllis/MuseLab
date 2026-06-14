import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type { Project } from "../model/types";
import { createEmptyPromptsByLocale, getNodeTextTemplateForLocale, parseLocalePrompts, setNodeTextTemplate } from "../locale/prompts";
import { parseProject } from "../model/project";
import { migrateProjectBundle } from "../model/projectBundle";
import { isStartNode } from "../model/nodeTypes";
import { getNodeDisplayName } from "../model/nodeNames";
import { makeRichExportProject } from "@/test/fixtures/richExportProject";
import { escapeCiStringLiteral } from "./ciString";
import { generateMuseLabEngineCi } from "./generateMuseLabEngineCi";
import { packExportArchive } from "./packExportArchive";
import {
  resolveStartNodeIdByName,
  resolveStoryEntryNodeId,
  resolveStoryIdByPath,
} from "./resolveStoryPath";

function getStoryGroupPath(project: Project, groupId?: string): string {
  if (!groupId) return "";
  const groups = project.storyGroups ?? [];
  const segments: string[] = [];
  let current: string | undefined = groupId;
  while (current) {
    const group = groups.find((entry) => entry.id === current);
    if (!group) break;
    segments.unshift(group.name);
    current = group.parentGroupId;
  }
  return segments.join("/");
}

function makeRoundTripProject(): Project {
  return makeRichExportProject();
}

function expectGeneratedResolversMatchProject(project: Project, ci: string): void {
  for (const story of project.stories) {
    const groupPath = getStoryGroupPath(project, story.groupId);
    expect(ci).toContain(
      `groupPath == ${escapeCiStringLiteral(groupPath)} && storyName == ${escapeCiStringLiteral(story.name)}`
    );
    expect(resolveStoryIdByPath(project, groupPath, story.name)).toBe(story.id);

    const entryNodeId = resolveStoryEntryNodeId(story);
    if (entryNodeId) {
      expect(ci).toContain(`if (storyId == ${escapeCiStringLiteral(story.id)})`);
      expect(ci).toContain(`return ${escapeCiStringLiteral(entryNodeId)};`);
    }

    for (const node of story.nodes) {
      if (!isStartNode(node)) continue;
      const startName = getNodeDisplayName(node, project);
      expect(resolveStartNodeIdByName(story, project, startName)).toBe(node.id);
      expect(ci).toContain(
        `storyId == ${escapeCiStringLiteral(story.id)} && startNodeName == ${escapeCiStringLiteral(startName)}`
      );
      expect(ci).toContain(`return ${escapeCiStringLiteral(node.id)};`);
    }
  }
}

describe("export round-trip", () => {
  it("generates resolver lookups that match TypeScript story path helpers", () => {
    const project = makeRoundTripProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    setNodeTextTemplate(
      promptsByLocale.en,
      "story-main",
      "scene-main",
      "Hello @rt.GetString(\"name\")"
    );

    const ci = generateMuseLabEngineCi({ project, promptsByLocale });

    expectGeneratedResolversMatchProject(project, ci);
    expect(ci).toContain('rt.SetBool("metGuide", false);');
    expect(ci).toContain("ApplyMissingStoryGlobalStateDefaults");
    expect(ci).toContain("EvaluateEdgeCondition");
    expect(ci).toContain('edgeId == "edge-jump"');
  });

  it("packs and restores project manifest and prompts from export archives", async () => {
    const project = makeRoundTripProject();
    const promptsByLocale = createEmptyPromptsByLocale(project.locales);
    setNodeTextTemplate(promptsByLocale.en, "story-main", "scene-main", "<p>Exported</p>");

    const bundle = { project, promptsByLocale };
    const ciSource = generateMuseLabEngineCi(bundle);
    const archive = await packExportArchive(bundle, ciSource, "public class MuseLabEngine {}", "cs");
    const entries = unzipSync(archive);

    expect(strFromU8(entries["MuseLabEngine.cs"])).toContain("MuseLabEngine");
    expect(strFromU8(entries["cito/MuseLabEngine.ci"])).toBe(ciSource);
    expect(strFromU8(entries["project.json"])).toContain('"Round Trip"');
    expect(entries["prompts.en.json"]).toBeDefined();

    const restoredProject = parseProject(strFromU8(entries["project.json"]));
    const restoredPrompts = {
      en: parseLocalePrompts(strFromU8(entries["prompts.en.json"]), restoredProject.stories[0]?.id),
    };
    const restoredBundle = migrateProjectBundle(restoredProject, restoredPrompts);

    expect(restoredBundle.project.name).toBe(project.name);
    expect(restoredBundle.project.stories).toHaveLength(2);

    const restoredMain = restoredBundle.project.stories.find((story) => story.name === "Main");
    expect(restoredMain).toBeDefined();
    expect(restoredMain?.edges[1]?.condition).toBe('rt.GetBool("metGuide")');

    const restoredSceneId = restoredMain?.nodes.find((node) => node.type === "scene")?.id;
    expect(restoredSceneId).toBeDefined();
    expect(
      getNodeTextTemplateForLocale(
        restoredBundle.promptsByLocale,
        "en",
        restoredMain!.id,
        restoredSceneId!
      )
    ).toBe("<p>Exported</p>");
  });
});
