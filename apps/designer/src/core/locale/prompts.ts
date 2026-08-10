import type { LocalePrompts, Project, SceneAction, StoryPrompts } from "../model/types";
import { getDefaultLocaleTag, normalizeLocaleTags } from "./localeTag";
import type { Locale } from "../model/types";
import { MUSELAB_FORMAT_VERSION, PROMPTS_SCHEMA_ID } from "../model/formatVersion";

export type PromptsByLocale = Record<string, LocalePrompts>;

export function createEmptyStoryPrompts(): StoryPrompts {
  return { nodes: {}, edges: {} };
}

export function createEmptyLocalePrompts(): LocalePrompts {
  return { stories: {} };
}

export function createEmptyPromptsByLocale(locales: Locale[] | string[]): PromptsByLocale {
  const promptsByLocale: PromptsByLocale = {};
  for (const locale of normalizeLocaleTags(locales)) {
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

export function ensureStoryPrompts(prompts: LocalePrompts, storyId: string): StoryPrompts {
  if (!prompts.stories[storyId]) {
    prompts.stories[storyId] = createEmptyStoryPrompts();
  }
  return prompts.stories[storyId];
}

export function ensurePromptsForProjectLocales(
  project: Project,
  promptsByLocale: PromptsByLocale
): PromptsByLocale {
  const next = { ...promptsByLocale };
  for (const locale of normalizeLocaleTags(project.locales)) {
    const localePrompts = ensureLocalePrompts(next, locale);
    for (const story of project.stories) {
      ensureStoryPrompts(localePrompts, story.id);
    }
  }
  return next;
}

export function ensureStoryPromptsForAllLocales(
  promptsByLocale: PromptsByLocale,
  project: Project,
  storyId: string
): void {
  for (const locale of normalizeLocaleTags(project.locales)) {
    ensureStoryPrompts(ensureLocalePrompts(promptsByLocale, locale), storyId);
  }
}

export function removeStoryFromAllLocales(
  promptsByLocale: PromptsByLocale,
  storyId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    delete prompts.stories[storyId];
  }
}

function getStoryPrompts(
  prompts: LocalePrompts | undefined,
  storyId: string
): StoryPrompts | undefined {
  return prompts?.stories[storyId];
}

export function getNodeActions(
  prompts: LocalePrompts | undefined,
  storyId: string,
  nodeId: string
): SceneAction[] {
  return getStoryPrompts(prompts, storyId)?.nodes[nodeId]?.actions ?? [];
}

export function setNodeActions(
  prompts: LocalePrompts,
  storyId: string,
  nodeId: string,
  actions: SceneAction[]
): void {
  const storyPrompts = ensureStoryPrompts(prompts, storyId);
  if (actions.length === 0) {
    delete storyPrompts.nodes[nodeId];
    return;
  }
  storyPrompts.nodes[nodeId] = { actions };
}

export function getEdgeOptionText(
  prompts: LocalePrompts | undefined,
  storyId: string,
  edgeId: string
): string | undefined {
  const value = getStoryPrompts(prompts, storyId)?.edges[edgeId]?.optionText;
  return value || undefined;
}

export function setEdgeOptionText(
  prompts: LocalePrompts,
  storyId: string,
  edgeId: string,
  value: string | undefined
): void {
  const storyPrompts = ensureStoryPrompts(prompts, storyId);
  if (!value) {
    delete storyPrompts.edges[edgeId];
    return;
  }
  storyPrompts.edges[edgeId] = { optionText: value };
}

export function getNodeActionsForLocale(
  promptsByLocale: PromptsByLocale,
  locale: string,
  storyId: string,
  nodeId: string
): SceneAction[] {
  return getNodeActions(promptsByLocale[locale], storyId, nodeId);
}

export function getEdgeOptionTextForLocale(
  promptsByLocale: PromptsByLocale,
  locale: string,
  storyId: string,
  edgeId: string
): string | undefined {
  return getEdgeOptionText(promptsByLocale[locale], storyId, edgeId);
}

export function getDefaultLocale(project: Project): string {
  return getDefaultLocaleTag(project.locales, project.defaultLocale);
}

export function removeNodeFromAllLocales(
  promptsByLocale: PromptsByLocale,
  storyId: string,
  nodeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    const storyPrompts = prompts.stories[storyId];
    if (storyPrompts) {
      delete storyPrompts.nodes[nodeId];
    }
  }
}

export function removeEdgeFromAllLocales(
  promptsByLocale: PromptsByLocale,
  storyId: string,
  edgeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    const storyPrompts = prompts.stories[storyId];
    if (storyPrompts) {
      delete storyPrompts.edges[edgeId];
    }
  }
}

export function cloneNodePrompts(
  promptsByLocale: PromptsByLocale,
  storyId: string,
  sourceNodeId: string,
  targetNodeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    const storyPrompts = ensureStoryPrompts(prompts, storyId);
    const source = storyPrompts.nodes[sourceNodeId];
    if (source?.actions?.length) {
      storyPrompts.nodes[targetNodeId] = {
        actions: JSON.parse(JSON.stringify(source.actions)) as SceneAction[],
      };
    } else {
      delete storyPrompts.nodes[targetNodeId];
    }
  }
}

export function cloneEdgePrompts(
  promptsByLocale: PromptsByLocale,
  storyId: string,
  sourceEdgeId: string,
  targetEdgeId: string
): void {
  for (const prompts of Object.values(promptsByLocale)) {
    const storyPrompts = ensureStoryPrompts(prompts, storyId);
    const source = storyPrompts.edges[sourceEdgeId];
    if (source?.optionText) {
      storyPrompts.edges[targetEdgeId] = { optionText: source.optionText };
    } else {
      delete storyPrompts.edges[targetEdgeId];
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

export function renameLocaleInPrompts(
  promptsByLocale: PromptsByLocale,
  fromTag: string,
  toTag: string
): PromptsByLocale {
  if (fromTag === toTag) {
    return promptsByLocale;
  }
  if (promptsByLocale[toTag]) {
    throw new Error(`Prompts for locale "${toTag}" already exist`);
  }
  const next = { ...promptsByLocale };
  if (next[fromTag]) {
    next[toTag] = next[fromTag];
    delete next[fromTag];
  }
  return next;
}

export function parseLocalePrompts(json: string): LocalePrompts {
  const data = JSON.parse(json) as LocalePrompts;
  if (!data.stories || typeof data.stories !== "object") {
    throw new Error("Prompts file is missing a stories object");
  }
  const stories: LocalePrompts["stories"] = {};
  for (const [storyId, storyPrompts] of Object.entries(data.stories)) {
    const nodes: StoryPrompts["nodes"] = {};
    for (const [nodeId, entry] of Object.entries(storyPrompts?.nodes ?? {})) {
      if (Array.isArray(entry?.actions) && entry.actions.length > 0) {
        nodes[nodeId] = { actions: entry.actions };
      }
    }
    stories[storyId] = {
      nodes,
      edges:
        storyPrompts?.edges && typeof storyPrompts.edges === "object"
          ? { ...storyPrompts.edges }
          : {},
    };
  }
  return { stories };
}

export function serializeLocalePrompts(prompts: LocalePrompts): string {
  const stories: LocalePrompts["stories"] = {};
  for (const [storyId, storyPrompts] of Object.entries(prompts.stories)) {
    const nodes: StoryPrompts["nodes"] = {};
    for (const [nodeId, entry] of Object.entries(storyPrompts.nodes)) {
      if (entry?.actions?.length) {
        nodes[nodeId] = { actions: entry.actions };
      }
    }

    const edges: StoryPrompts["edges"] = {};
    for (const [edgeId, entry] of Object.entries(storyPrompts.edges)) {
      if (entry?.optionText) {
        edges[edgeId] = { optionText: entry.optionText };
      }
    }

    if (Object.keys(nodes).length > 0 || Object.keys(edges).length > 0) {
      stories[storyId] = { nodes, edges };
    }
  }

  return JSON.stringify(
    {
      $schema: PROMPTS_SCHEMA_ID,
      formatVersion: MUSELAB_FORMAT_VERSION,
      stories,
    },
    null,
    2
  );
}

export function clonePromptsByLocale(promptsByLocale: PromptsByLocale): PromptsByLocale {
  return JSON.parse(JSON.stringify(promptsByLocale)) as PromptsByLocale;
}
