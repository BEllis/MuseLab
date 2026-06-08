import type { Project, StoryEdge, StoryNode } from "@/core/model/types";
import type { PromptsByLocale } from "@/core/locale/prompts";
import { getDefaultLocale, getEdgeOptionTextForLocale, getNodeTextTemplateForLocale } from "@/core/locale/prompts";
import { evaluateCondition, runTemplate } from "@/core/template/engine";
import type { TemplateContext } from "@/core/template/sandbox";

export type SceneStageChoice = {
  edge: StoryEdge;
  targetNode: StoryNode;
  optionText?: string;
};

export function getNodeChoices(
  project: Project,
  nodeId: string,
  promptsByLocale: PromptsByLocale,
  locale?: string
): SceneStageChoice[] {
  const activeLocale = locale ?? getDefaultLocale(project);
  const choices: SceneStageChoice[] = [];

  for (const edge of project.edges) {
    if (edge.sourceNodeId !== nodeId) continue;
    if (!evaluateCondition(edge.condition, { state: project.globalState })) continue;

    const targetNode = project.nodes.find((node) => node.id === edge.targetNodeId);
    if (targetNode) {
      choices.push({
        edge,
        targetNode,
        optionText: getEdgeOptionTextForLocale(promptsByLocale, activeLocale, edge.id),
      });
    }
  }

  return choices;
}

function previewTemplateContext(globalState: Project["globalState"]): TemplateContext {
  return {
    state: { ...globalState },
    setState: () => {},
    emit: () => {},
    call: () => undefined,
    playSound: () => {},
  };
}

export function renderNodePreviewHtml(
  textTemplate: string,
  globalState: Project["globalState"]
): string {
  return runTemplate(textTemplate, previewTemplateContext(globalState));
}

export function renderNodePreviewHtmlForLocale(
  project: Project,
  promptsByLocale: PromptsByLocale,
  nodeId: string,
  locale?: string
): string {
  const activeLocale = locale ?? getDefaultLocale(project);
  const textTemplate = getNodeTextTemplateForLocale(promptsByLocale, activeLocale, nodeId);
  return renderNodePreviewHtml(textTemplate, project.globalState);
}
