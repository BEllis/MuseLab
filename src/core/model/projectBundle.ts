import type { LocalePrompts, Project } from "./types";
import {
  clonePromptsByLocale,
  createEmptyPromptsByLocale,
  migrateLegacyInlinePrompts,
  parseLocalePrompts,
  serializeLocalePrompts,
  type PromptsByLocale,
} from "../locale/prompts";
import { normalizeLocales } from "../locale/localeTag";
import { createEmptyProject, parseProject, serializeProject } from "./project";

export interface ProjectBundle {
  project: Project;
  promptsByLocale: PromptsByLocale;
}

export function createEmptyBundle(name: string = "Untitled"): ProjectBundle {
  const project = createEmptyProject(name);
  return {
    project,
    promptsByLocale: createEmptyPromptsByLocale(project.locales),
  };
}

export function cloneProjectBundle(bundle: ProjectBundle): ProjectBundle {
  return {
    project: JSON.parse(JSON.stringify(bundle.project)) as Project,
    promptsByLocale: clonePromptsByLocale(bundle.promptsByLocale),
  };
}

export function migrateProjectBundle(project: Project, promptsByLocale?: PromptsByLocale): ProjectBundle {
  project.locales = normalizeLocales(project.locales);
  const basePrompts = promptsByLocale ?? createEmptyPromptsByLocale(project.locales);
  const migratedPrompts = migrateLegacyInlinePrompts(project, basePrompts);
  return {
    project,
    promptsByLocale: migratedPrompts,
  };
}

export interface StoredProjectPayload {
  project: Project;
  promptsByLocale: PromptsByLocale;
}

export function parseStoredProjectPayload(raw: string): ProjectBundle {
  const data = JSON.parse(raw) as StoredProjectPayload | Project;

  if ("promptsByLocale" in data && data.promptsByLocale) {
    const project = parseProject(JSON.stringify(data.project));
    const promptsByLocale: PromptsByLocale = {};
    for (const [locale, prompts] of Object.entries(data.promptsByLocale)) {
      promptsByLocale[locale] = parseLocalePrompts(JSON.stringify(prompts));
    }
    return migrateProjectBundle(project, promptsByLocale);
  }

  const project = parseProject(raw);
  return migrateProjectBundle(project);
}

export function serializeStoredProjectPayload(bundle: ProjectBundle): string {
  return JSON.stringify(
    {
      project: JSON.parse(serializeProject(bundle.project)) as Project,
      promptsByLocale: bundle.promptsByLocale,
    },
    null,
    2
  );
}

export function serializeProjectBundleSnapshot(bundle: ProjectBundle): string {
  const manifest = serializeProject(bundle.project);
  const promptEntries = normalizeLocales(bundle.project.locales)
    .map((locale) => {
      const prompts = bundle.promptsByLocale[locale] ?? { nodes: {}, edges: {} };
      return [locale, serializeLocalePrompts(prompts)] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify({ manifest, prompts: Object.fromEntries(promptEntries) });
}

export function parseProjectBundleSnapshot(raw: string): ProjectBundle {
  const data = JSON.parse(raw) as {
    manifest: string;
    prompts: Record<string, string>;
  };
  const project = parseProject(data.manifest);
  const promptsByLocale: PromptsByLocale = {};
  for (const [locale, promptsJson] of Object.entries(data.prompts ?? {})) {
    promptsByLocale[locale] = parseLocalePrompts(promptsJson);
  }
  return migrateProjectBundle(project, promptsByLocale);
}

export function getLocalePromptsFromMap(
  prompts: Map<string, LocalePrompts>,
  locale: string
): LocalePrompts {
  return prompts.get(locale) ?? { nodes: {}, edges: {} };
}
