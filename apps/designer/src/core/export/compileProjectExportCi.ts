import type { Project } from "../model/types";
import type { PromptsByLocale } from "../locale/prompts";
import { getEdgeOptionTextForLocale, getNodeActionsForLocale } from "../locale/prompts";
import { isSceneNode } from "../model/nodeTypes";
import { compileCondition } from "../cito/compileCondition";
import { compileTemplate } from "../cito/compileTemplate";
import { compileSceneActions } from "../scene/compileSceneActions";
import { storyWrapTemplates } from "../template/storyTemplateWrap";
import { normalizeLocaleTags } from "../locale/localeTag";

export type ExportTemplateRef =
  | { kind: "prompt"; className: string }
  | { kind: "none" };

export type CompiledProjectExport = {
  classSources: string[];
  edgeConditionClass: Map<string, string>;
  nodeTemplateClass: Map<string, ExportTemplateRef>;
};

function refKey(parts: string[]): string {
  return parts.join("\0");
}

export function compileProjectExportCi(
  project: Project,
  promptsByLocale: PromptsByLocale
): CompiledProjectExport {
  const classBodies = new Map<string, string>();
  const edgeConditionClass = new Map<string, string>();
  const nodeTemplateClass = new Map<string, ExportTemplateRef>();

  const compileOptions = { forExport: true, includePreamble: false };

  function rememberClass(className: string, classSource: string): void {
    if (!classBodies.has(className)) {
      classBodies.set(className, classSource.trim());
    }
  }

  for (const story of project.stories) {
    for (const edge of story.edges) {
      const condition = edge.condition?.trim() ?? "";
      const edgeKey = refKey([story.id, edge.id]);
      if (!condition) {
        edgeConditionClass.set(edgeKey, "");
        continue;
      }
      const compiled = compileCondition(condition, project, compileOptions);
      rememberClass(compiled.className, compiled.ciSource);
      edgeConditionClass.set(edgeKey, compiled.className);
    }

    const wrap = storyWrapTemplates(story);

    for (const node of story.nodes) {
      if (!isSceneNode(node)) continue;

      for (const locale of normalizeLocaleTags(project.locales)) {
        const actions = getNodeActionsForLocale(promptsByLocale, locale, story.id, node.id);
        const promptKey = refKey([locale, story.id, node.id, "prompt"]);
        if (actions.length === 0) {
          nodeTemplateClass.set(promptKey, { kind: "none" });
          continue;
        }
        const compiled = compileSceneActions(actions, project, { ...compileOptions, wrap });
        rememberClass(compiled.className, compiled.ciSource);
        nodeTemplateClass.set(promptKey, { kind: "prompt", className: compiled.className });
      }
    }
  }

  for (const story of project.stories) {
    for (const edge of story.edges) {
      for (const locale of normalizeLocaleTags(project.locales)) {
        const optionText = getEdgeOptionTextForLocale(
          promptsByLocale,
          locale,
          story.id,
          edge.id
        );
        if (!optionText?.trim()) continue;
        const edgePromptKey = refKey([locale, story.id, edge.id, "option"]);
        if (nodeTemplateClass.has(edgePromptKey)) continue;
        const compiled = compileTemplate(optionText, project, compileOptions);
        rememberClass(compiled.className, compiled.ciSource);
        nodeTemplateClass.set(edgePromptKey, { kind: "prompt", className: compiled.className });
      }
    }
  }

  return {
    classSources: [...classBodies.values()],
    edgeConditionClass,
    nodeTemplateClass,
  };
}
