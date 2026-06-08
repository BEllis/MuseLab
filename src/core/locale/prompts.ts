import type { LocalePrompts, Project, StoryEdge, StoryNode } from "../model/types";
import { DEFAULT_LOCALES, normalizeLocales } from "./localeTag";

export type PromptsByLocale = Record<string, LocalePrompts>;

export function createEmptyLocalePrompts(): LocalePrompts {
  return { nodes: {}, edges: {} };
}

export function createEmptyPromptsByLocale(locales: string[]): PromptsByLocale {
  const promptsByLocale: PromptsByLocale = {};
  for (const locale of normalizeLocales(locales)) {
    promptsByLocale[locale] = createEmptyLocalePrompts();
  }
  return promptsByLocale;
}

export function ensureLocalePrompts(
  promptsByLocale: PromptsByLocale,
  locale: string
): LocalePrompts {
  if (!promptsByLocale[locale]) {
    promptsByLocale[locale] = createEmptyLocalePrompts();
  }
  return promptsByLocale[locale];
}

export function ensurePromptsForProjectLocales(
  project: Project,
  promptsByLocale: PromptsByLocale
): PromptsByLocale {
  const next = { ...promptsByLocale };
  for (const locale of normalizeLocales(project.locales)) {
    ensureLocalePrompts(next, locale);
  }
  return next;
}

export function getNodeTextTemplate(prompts: LocalePrompts | undefined, nodeId: string): string {
  return prompts?.nodes[nodeId]?.textTemplate ?? "";
}

export function setNodeTextTemplate(
  prompts: LocalePrompts,
  nodeId: string,
  value: string
): void {
  if (!value) {
    delete prompts.nodes[nodeId];
    return;
  }
  prompts.nodes[nodeId] = { textTemplate: value };
}

export function getEdgeOptionText(
  prompts: LocalePrompts | undefined,
  edgeId: string
): string | undefined {
  const value = prompts?.edges[edgeId]?.optionText;
  return value || undefined;
}

export function setEdgeOptionText(
  prompts: LocalePrompts,
  edgeId: string,
  value: string | undefined
): void {
  if (!value) {
    delete prompts.edges[edgeId];
    return;
  }
  prompts.edges[edgeId] = { optionText: value };
}

export function getNodeTextTemplateForLocale(
  promptsByLocale: PromptsByLocale,
  locale: string,
  nodeId: string
): string {
  return getNodeTextTemplate(promptsByLocale[locale], nodeId);
}

export function getEdgeOptionTextForLocale(
  promptsByLocale: PromptsByLocale,
  locale: string,
  edgeId: string
): string | undefined {
  return getEdgeOptionText(promptsByLocale[locale], edgeId);
}

export function getDefaultLocale(project: Project): string {
  return normalizeLocales(project.locales)[0] ?? DEFAULT_LOCALES[0];
}

export function removeNodeFromAllLocales(
  promptsByLocale: PromptsByLocale,
  nodeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    delete prompts.nodes[nodeId];
  }
}

export function removeEdgeFromAllLocales(
  promptsByLocale: PromptsByLocale,
  edgeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    delete prompts.edges[edgeId];
  }
}

export function cloneNodePrompts(
  promptsByLocale: PromptsByLocale,
  sourceNodeId: string,
  targetNodeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    const source = prompts.nodes[sourceNodeId];
    if (source?.textTemplate) {
      prompts.nodes[targetNodeId] = { textTemplate: source.textTemplate };
    } else {
      delete prompts.nodes[targetNodeId];
    }
  }
}

export function cloneEdgePrompts(
  promptsByLocale: PromptsByLocale,
  sourceEdgeId: string,
  targetEdgeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    const source = prompts.edges[sourceEdgeId];
    if (source?.optionText) {
      prompts.edges[targetEdgeId] = { optionText: source.optionText };
    } else {
      delete prompts.edges[targetEdgeId];
    }
  }
}

export function removeLocaleFromPrompts(
  promptsByLocale: PromptsByLocale,
  locale: string
): PromptsByLocale {
  const next = { ...promptsByLocale };
  delete next[locale];
  return next;
}

export function parseLocalePrompts(json: string): LocalePrompts {
  const data = JSON.parse(json) as Partial<LocalePrompts>;
  return {
    nodes: data.nodes && typeof data.nodes === "object" ? { ...data.nodes } : {},
    edges: data.edges && typeof data.edges === "object" ? { ...data.edges } : {},
  };
}

export function serializeLocalePrompts(prompts: LocalePrompts): string {
  const nodes: LocalePrompts["nodes"] = {};
  for (const [nodeId, entry] of Object.entries(prompts.nodes)) {
    if (entry?.textTemplate) {
      nodes[nodeId] = { textTemplate: entry.textTemplate };
    }
  }

  const edges: LocalePrompts["edges"] = {};
  for (const [edgeId, entry] of Object.entries(prompts.edges)) {
    if (entry?.optionText) {
      edges[edgeId] = { optionText: entry.optionText };
    }
  }

  return JSON.stringify({ nodes, edges }, null, 2);
}

export function clonePromptsByLocale(promptsByLocale: PromptsByLocale): PromptsByLocale {
  return JSON.parse(JSON.stringify(promptsByLocale)) as PromptsByLocale;
}

type LegacyStoryNode = StoryNode & { textTemplate?: string };
type LegacyStoryEdge = StoryEdge & { optionText?: string };

export function migrateLegacyInlinePrompts(
  project: Project,
  promptsByLocale: PromptsByLocale
): PromptsByLocale {
  const targetLocale = getDefaultLocale(project);
  const prompts = ensureLocalePrompts({ ...promptsByLocale }, targetLocale);

  for (const node of project.nodes as LegacyStoryNode[]) {
    const textTemplate = node.textTemplate;
    if (textTemplate) {
      setNodeTextTemplate(prompts, node.id, textTemplate);
    }
    delete node.textTemplate;
  }

  for (const edge of project.edges as LegacyStoryEdge[]) {
    const optionText = edge.optionText;
    if (optionText) {
      setEdgeOptionText(prompts, edge.id, optionText);
    }
    delete edge.optionText;
  }

  return ensurePromptsForProjectLocales(project, {
    ...promptsByLocale,
    [targetLocale]: prompts,
  });
}
