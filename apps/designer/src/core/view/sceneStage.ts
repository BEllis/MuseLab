import type { Project, Story, StoryEdge, StoryNode } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
import {
  getDefaultLocale,
  getEdgeOptionTextForLocale,
  getNodeActionsForLocale,
} from "@/core/locale/prompts";
import type { SceneAction } from "@/core/model/types";
import {
  evaluateCondition,
  runSceneActions,
  type RunTemplateResult,
} from "@/core/template/engine";
import { storyWrapTemplates } from "@/core/template/storyTemplateWrap";
import { finalSpeakerHtml } from "@/core/prompt/executePromptInstructions";
import type { TemplateContext } from "@/core/cito/runtimeBridge";

export type SceneStageChoice = {
  edge: StoryEdge;
  targetNode: StoryNode;
  optionText?: string;
};

export async function getNodeChoices(
  story: Story,
  storyId: string,
  nodeId: string,
  project: Project,
  promptsByLocale: PromptsByLocale,
  locale?: string
): Promise<SceneStageChoice[]> {
  const activeLocale = locale ?? getDefaultLocale(project);
  const choices: SceneStageChoice[] = [];

  for (const edge of story.edges) {
    if (edge.sourceNodeId !== nodeId) continue;
    if (!(await evaluateCondition(edge.condition, { state: story.globalState }, project))) continue;

    const targetNode = story.nodes.find((node) => node.id === edge.targetNodeId);
    if (targetNode) {
      choices.push({
        edge,
        targetNode,
        optionText: getEdgeOptionTextForLocale(
          promptsByLocale,
          activeLocale,
          storyId,
          edge.id
        ),
      });
    }
  }

  return choices;
}

function previewTemplateContext(
  project: Project,
  globalState: Story["globalState"]
): TemplateContext {
  return {
    state: { ...globalState },
    project,
    setState: () => {},
    emit: () => {},
    call: () => undefined,
    playSound: () => {},
  };
}

export type RenderNodePreviewOptions = {
  project: Project;
  disableShake?: boolean;
};

export type RenderNodePreviewLocaleOptions = {
  disableShake?: boolean;
};

/** True when rendered HTML contains visible text (ignores empty tags and whitespace). */
export function hasVisibleRichText(html: string): boolean {
  if (!html.trim()) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().length > 0;
}

export async function renderScenePreviewResult(
  story: Story,
  actions: SceneAction[],
  options: RenderNodePreviewOptions
): Promise<RunTemplateResult> {
  return runSceneActions(actions, previewTemplateContext(options.project, story.globalState), {
    ...options,
    wrap: storyWrapTemplates(story),
  });
}

export async function renderScenePreviewResultForLocale(
  story: Story,
  storyId: string,
  project: Project,
  promptsByLocale: PromptsByLocale,
  nodeId: string,
  locale?: string,
  options: RenderNodePreviewLocaleOptions = {}
): Promise<RunTemplateResult> {
  const activeLocale = locale ?? getDefaultLocale(project);
  const actions = getNodeActionsForLocale(promptsByLocale, activeLocale, storyId, nodeId);
  return renderScenePreviewResult(story, actions, { ...options, project });
}

export async function renderNodePreviewHtmlForLocale(
  story: Story,
  storyId: string,
  project: Project,
  promptsByLocale: PromptsByLocale,
  nodeId: string,
  locale?: string,
  options: RenderNodePreviewLocaleOptions = {}
): Promise<string> {
  const result = await renderScenePreviewResultForLocale(
    story,
    storyId,
    project,
    promptsByLocale,
    nodeId,
    locale,
    options
  );
  return result.html;
}

export async function renderNodeSpeakerForLocale(
  story: Story,
  storyId: string,
  project: Project,
  promptsByLocale: PromptsByLocale,
  nodeId: string,
  locale?: string,
  options: RenderNodePreviewLocaleOptions = {}
): Promise<string> {
  const result = await renderScenePreviewResultForLocale(
    story,
    storyId,
    project,
    promptsByLocale,
    nodeId,
    locale,
    options
  );
  return finalSpeakerHtml(result.instructions, "");
}
