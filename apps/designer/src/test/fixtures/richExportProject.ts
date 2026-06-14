import type { Project, Story } from "@/core/model/types";
import { normalizeLocales } from "@/core/locale/localeTag";

export function makeRichExportProject(): Project {
  const storyMain: Story = {
    id: "story-main",
    name: "Main",
    groupId: "group-ch1",
    entryNodeId: "start-main",
    globalState: { metGuide: false, trust: 1 },
    nodes: [
      { id: "start-main", type: "start", position: { x: 0, y: 0 }, label: "Intro" },
      {
        id: "scene-main",
        type: "scene",
        position: { x: 100, y: 0 },
        backdropId: "muselab-default-backdrop",
      },
      {
        id: "jump-side",
        type: "jump",
        position: { x: 200, y: 0 },
        jumpTargetStoryId: "story-side",
        jumpTargetStartNodeId: "start-side",
      },
    ],
    edges: [
      { id: "edge-main", sourceNodeId: "start-main", targetNodeId: "scene-main" },
      {
        id: "edge-jump",
        sourceNodeId: "scene-main",
        targetNodeId: "jump-side",
        condition: 'rt.GetBool("metGuide")',
      },
    ],
  };
  const storySide: Story = {
    id: "story-side",
    name: "Side",
    entryNodeId: "start-side",
    globalState: { trust: 0, chapterStarted: true },
    nodes: [{ id: "start-side", type: "start", position: { x: 0, y: 0 }, label: "Side Start" }],
    edges: [],
  };

  return {
    name: "Round Trip",
    assets: [],
    locales: normalizeLocales(["en"]),
    modules: [],
    storyGroups: [{ id: "group-ch1", name: "Chapter1" }],
    stories: [storyMain, storySide],
  };
}
