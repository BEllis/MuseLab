import type { Project } from "../model/types";
import type { PromptsByLocale } from "../locale/prompts";
import {
  getEdgeOptionTextForLocale,
  getNodeSpeakerForLocale,
  getNodeTextTemplateForLocale,
} from "../locale/prompts";
import { isSceneNode } from "../model/nodeTypes";
import { compileCondition } from "../cito/compileCondition";
import { compileTemplate } from "../cito/compileTemplate";
import {
  wrapStoryPromptTemplate,
  wrapStorySpeakerTemplate,
} from "../template/storyTemplateWrap";
import { normalizeLocaleTags } from "../locale/localeTag";

export type ExportTemplateRef =
  | { kind: "prompt"; className: string }
  | { kind: "speaker"; className: string }
  | { kind: "none" };

export type CompiledProjectExport = {
  classSources: string[];
  edgeConditionClass: Map<string, string>;
  nodeTemplateClass: Map<string, ExportTemplateRef>;
  nodeSpeakerClass: Map<string, string | null>;
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
  const nodeSpeakerClass = new Map<string, string | null>();

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

    for (const node of story.nodes) {
      if (!isSceneNode(node)) continue;

      for (const locale of normalizeLocaleTags(project.locales)) {
        const textTemplate = getNodeTextTemplateForLocale(
          promptsByLocale,
          locale,
          story.id,
          node.id
        );
        const promptKey = refKey([locale, story.id, node.id, "prompt"]);
        if (!textTemplate.trim()) {
          nodeTemplateClass.set(promptKey, { kind: "none" });
        } else {
          const wrapped = wrapStoryPromptTemplate(story, textTemplate);
          const compiled = compileTemplate(wrapped, project, compileOptions);
          rememberClass(compiled.className, compiled.ciSource);
          nodeTemplateClass.set(promptKey, { kind: "prompt", className: compiled.className });
        }

        const speaker = getNodeSpeakerForLocale(promptsByLocale, locale, story.id, node.id);
        const speakerKey = refKey([locale, story.id, node.id, "speaker"]);
        if (!speaker.trim()) {
          nodeSpeakerClass.set(speakerKey, null);
        } else {
          const wrapped = wrapStorySpeakerTemplate(story, speaker);
          const compiled = compileTemplate(wrapped, project, compileOptions);
          rememberClass(compiled.className, compiled.ciSource);
          nodeSpeakerClass.set(speakerKey, compiled.className);
        }
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
    nodeSpeakerClass,
  };
}
