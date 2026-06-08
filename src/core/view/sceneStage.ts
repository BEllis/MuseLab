import type { Project, Story, StoryEdge, StoryNode } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
import {
  getDefaultLocale,
  getEdgeOptionTextForLocale,
  getNodeSpeakerForLocale,
  getNodeTextTemplateForLocale,
} from "@/core/locale/prompts";
import { evaluateCondition, runTemplate } from "@/core/template/engine";
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
    if (!(await evaluateCondition(edge.condition, { state: story.globalState }))) continue;

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

function previewTemplateContext(globalState: Story["globalState"]): TemplateContext {
  return {
    state: { ...globalState },
    setState: () => {},
    emit: () => {},
    call: () => undefined,
    playSound: () => {},
  };
}

export type RenderNodePreviewOptions = {
  disableShake?: boolean;
};

export async function renderNodePreviewHtml(
  textTemplate: string,
  globalState: Story["globalState"],
  options: RenderNodePreviewOptions = {}
): Promise<string> {
  return runTemplate(textTemplate, previewTemplateContext(globalState), options);
}

export async function renderNodePreviewHtmlForLocale(
  story: Story,
  storyId: string,
  project: Project,
  promptsByLocale: PromptsByLocale,
  nodeId: string,
  locale?: string,
  options: RenderNodePreviewOptions = {}
): Promise<string> {
  const activeLocale = locale ?? getDefaultLocale(project);
  const textTemplate = getNodeTextTemplateForLocale(
    promptsByLocale,
    activeLocale,
    storyId,
    nodeId
  );
  return renderNodePreviewHtml(textTemplate, story.globalState, options);
}

export async function renderNodeSpeakerForLocale(
  story: Story,
  storyId: string,
  project: Project,
  promptsByLocale: PromptsByLocale,
  nodeId: string,
  locale?: string,
  options: RenderNodePreviewOptions = {}
): Promise<string> {
  const activeLocale = locale ?? getDefaultLocale(project);
  const speaker = getNodeSpeakerForLocale(promptsByLocale, activeLocale, storyId, nodeId);
  if (!speaker) return "";
  return renderNodePreviewHtml(speaker, story.globalState, options);
}
