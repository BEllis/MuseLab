import type { Project, StoryEdge, StoryNode } from "@/core/model/types";
import { evaluateCondition, runTemplate } from "@/core/template/engine";
import type { TemplateContext } from "@/core/template/sandbox";

export type SceneStageChoice = {
  edge: StoryEdge;
  targetNode: StoryNode;
};

export function getNodeChoices(project: Project, nodeId: string): SceneStageChoice[] {
  const choices: SceneStageChoice[] = [];

  for (const edge of project.edges) {
    if (edge.sourceNodeId !== nodeId) continue;
    if (!evaluateCondition(edge.condition, { state: project.globalState })) continue;

    const targetNode = project.nodes.find((node) => node.id === edge.targetNodeId);
    if (targetNode) choices.push({ edge, targetNode });
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
