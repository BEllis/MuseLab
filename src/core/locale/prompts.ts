import type { LocalePrompts, Project, StoryEdge, StoryNode, StoryPrompts } from "../model/types";
import { getDefaultLocaleTag, normalizeLocaleTags } from "./localeTag";
import type { Locale } from "../model/types";
import { MUSELAB_FORMAT_VERSION, PROMPTS_SCHEMA_ID } from "../model/formatVersion";

export type PromptsByLocale = Record<string, LocalePrompts>;

type LegacyFlatLocalePrompts = {
  nodes?: Record<string, { textTemplate?: string; speaker?: string }>;
  edges?: Record<string, { optionText?: string }>;
};

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

export function getNodeTextTemplate(
  prompts: LocalePrompts | undefined,
  storyId: string,
  nodeId: string
): string {
  return getStoryPrompts(prompts, storyId)?.nodes[nodeId]?.textTemplate ?? "";
}

export function getNodeSpeaker(
  prompts: LocalePrompts | undefined,
  storyId: string,
  nodeId: string
): string {
  return getStoryPrompts(prompts, storyId)?.nodes[nodeId]?.speaker ?? "";
}

function pruneNodePromptEntry(storyPrompts: StoryPrompts, nodeId: string): void {
  const entry = storyPrompts.nodes[nodeId];
  if (!entry?.textTemplate && !entry?.speaker) {
    delete storyPrompts.nodes[nodeId];
  }
}

export function setNodeTextTemplate(
  prompts: LocalePrompts,
  storyId: string,
  nodeId: string,
  value: string
): void {
  const storyPrompts = ensureStoryPrompts(prompts, storyId);
  if (!value) {
    if (storyPrompts.nodes[nodeId]) {
      delete storyPrompts.nodes[nodeId].textTemplate;
      pruneNodePromptEntry(storyPrompts, nodeId);
    }
    return;
  }
  const entry = storyPrompts.nodes[nodeId] ?? {};
  entry.textTemplate = value;
  storyPrompts.nodes[nodeId] = entry;
}

export function setNodeSpeaker(
  prompts: LocalePrompts,
  storyId: string,
  nodeId: string,
  value: string
): void {
  const storyPrompts = ensureStoryPrompts(prompts, storyId);
  if (!value) {
    if (storyPrompts.nodes[nodeId]) {
      delete storyPrompts.nodes[nodeId].speaker;
      pruneNodePromptEntry(storyPrompts, nodeId);
    }
    return;
  }
  const entry = storyPrompts.nodes[nodeId] ?? {};
  entry.speaker = value;
  storyPrompts.nodes[nodeId] = entry;
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

export function getNodeTextTemplateForLocale(
  promptsByLocale: PromptsByLocale,
  locale: string,
  storyId: string,
  nodeId: string
): string {
  return getNodeTextTemplate(promptsByLocale[locale], storyId, nodeId);
}

export function getNodeSpeakerForLocale(
  promptsByLocale: PromptsByLocale,
  locale: string,
  storyId: string,
  nodeId: string
): string {
  return getNodeSpeaker(promptsByLocale[locale], storyId, nodeId);
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
    if (source?.textTemplate || source?.speaker) {
      storyPrompts.nodes[targetNodeId] = {
        ...(source.textTemplate ? { textTemplate: source.textTemplate } : {}),
        ...(source.speaker ? { speaker: source.speaker } : {}),
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

function migrateLegacyFlatPrompts(data: LegacyFlatLocalePrompts, storyId: string): LocalePrompts {
  return {
    stories: {
      [storyId]: {
        nodes: data.nodes && typeof data.nodes === "object" ? { ...data.nodes } : {},
        edges: data.edges && typeof data.edges === "object" ? { ...data.edges } : {},
      },
    },
  };
}

export function parseLocalePrompts(json: string, defaultStoryId?: string): LocalePrompts {
  const data = JSON.parse(json) as LegacyFlatLocalePrompts & LocalePrompts;
  if (data.stories && typeof data.stories === "object") {
    const stories: LocalePrompts["stories"] = {};
    for (const [storyId, storyPrompts] of Object.entries(data.stories)) {
      stories[storyId] = {
        nodes:
          storyPrompts?.nodes && typeof storyPrompts.nodes === "object"
            ? { ...storyPrompts.nodes }
            : {},
        edges:
          storyPrompts?.edges && typeof storyPrompts.edges === "object"
            ? { ...storyPrompts.edges }
            : {},
      };
    }
    return { stories };
  }

  if (!defaultStoryId) {
    throw new Error("Legacy flat prompts require a default story id");
  }
  return migrateLegacyFlatPrompts(data, defaultStoryId);
}

export function serializeLocalePrompts(prompts: LocalePrompts): string {
  const stories: LocalePrompts["stories"] = {};
  for (const [storyId, storyPrompts] of Object.entries(prompts.stories)) {
    const nodes: StoryPrompts["nodes"] = {};
    for (const [nodeId, entry] of Object.entries(storyPrompts.nodes)) {
      if (entry?.textTemplate || entry?.speaker) {
        nodes[nodeId] = {
          ...(entry.textTemplate ? { textTemplate: entry.textTemplate } : {}),
          ...(entry.speaker ? { speaker: entry.speaker } : {}),
        };
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

type LegacyStoryNode = StoryNode & { textTemplate?: string };
type LegacyStoryEdge = StoryEdge & { optionText?: string };

export function migrateLegacyInlinePrompts(
  project: Project,
  promptsByLocale: PromptsByLocale
): PromptsByLocale {
  const defaultStoryId = project.stories[0]?.id;
  if (!defaultStoryId) {
    return ensurePromptsForProjectLocales(project, promptsByLocale);
  }

  const migratedByLocale: PromptsByLocale = {};
  for (const [locale, rawPrompts] of Object.entries(promptsByLocale)) {
    if (rawPrompts.stories && Object.keys(rawPrompts.stories).length > 0) {
      migratedByLocale[locale] = rawPrompts;
    } else {
      const legacy = rawPrompts as unknown as LegacyFlatLocalePrompts;
      migratedByLocale[locale] = migrateLegacyFlatPrompts(legacy, defaultStoryId);
    }
  }

  const targetLocale = getDefaultLocale(project);
  const prompts = ensureLocalePrompts({ ...migratedByLocale }, targetLocale);
  const story = project.stories[0];
  if (!story) {
    return ensurePromptsForProjectLocales(project, migratedByLocale);
  }

  const storyPrompts = ensureStoryPrompts(prompts, story.id);
  for (const node of story.nodes as LegacyStoryNode[]) {
    const textTemplate = node.textTemplate;
    if (textTemplate) {
      setNodeTextTemplate(prompts, story.id, node.id, textTemplate);
    }
    delete node.textTemplate;
  }

  for (const edge of story.edges as LegacyStoryEdge[]) {
    const optionText = edge.optionText;
    if (optionText) {
      setEdgeOptionText(prompts, story.id, edge.id, optionText);
    }
    delete edge.optionText;
  }

  void storyPrompts;

  return ensurePromptsForProjectLocales(project, {
    ...migratedByLocale,
    [targetLocale]: prompts,
  });
}
