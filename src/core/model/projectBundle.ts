import type { LocalePrompts, Project } from "./types";
import type { PersistedSessionPayload } from "../events/persistedSession";
import {
  clonePromptsByLocale,
  createEmptyPromptsByLocale,
  ensurePromptsForProjectLocales,
  migrateLegacyInlinePrompts,
  parseLocalePrompts,
  serializeLocalePrompts,
  type PromptsByLocale,
} from "../locale/prompts";
import { migrateProjectDefaultLocale, normalizeLocales } from "../locale/localeTag";
import {
  createEmptyProject,
  finalizeProjectNodes,
  getFirstStoryId,
  normalizeProjectModules,
  parseProject,
  serializeProject,
} from "./project";
import { migrateProjectIdsToUuid, type BlobKeyRemapping } from "./migrateIds";
import {
  BUNDLE_SCHEMA_ID,
  MUSELAB_FORMAT_VERSION,
  MLVN_SCHEMA_ID,
} from "./formatVersion";

export interface ProjectBundle {
  project: Project;
  promptsByLocale: PromptsByLocale;
  /** Populated when legacy ids are migrated on load; cleared after blob keys are remapped. */
  blobKeyRemappings?: BlobKeyRemapping[];
}

export function createEmptyBundle(name: string = "Untitled"): ProjectBundle {
  const project = createEmptyProject(name);
  return {
    project,
    promptsByLocale: createEmptyPromptsByLocale(project.locales),
    blobKeyRemappings: [],
  };
}

export function cloneProjectBundle(bundle: ProjectBundle): ProjectBundle {
  return {
    project: JSON.parse(JSON.stringify(bundle.project)) as Project,
    promptsByLocale: clonePromptsByLocale(bundle.promptsByLocale),
    blobKeyRemappings: [],
  };
}

export function migrateProjectBundle(project: Project, promptsByLocale?: PromptsByLocale): ProjectBundle {
  normalizeProjectModules(project);
  migrateProjectDefaultLocale(project);
  const defaultStoryId = project.stories[0]?.id;
  const basePrompts =
    promptsByLocale ??
    createEmptyPromptsByLocale(project.locales);
  const migratedPrompts = migrateLegacyInlinePrompts(project, basePrompts);
  finalizeProjectNodes(project);
  if (defaultStoryId) {
    for (const locale of normalizeLocales(project.locales)) {
      const raw = migratedPrompts[locale];
      if (raw && (!raw.stories || Object.keys(raw.stories).length === 0)) {
        migratedPrompts[locale] = parseLocalePrompts(
          JSON.stringify(raw),
          defaultStoryId
        );
      }
    }
  }
  const prompts = ensurePromptsForProjectLocales(project, migratedPrompts);
  const { blobKeyRemappings } = migrateProjectIdsToUuid(project, prompts);
  return {
    project,
    promptsByLocale: prompts,
    blobKeyRemappings,
  };
}

export interface StoredProjectPayload {
  formatVersion?: number;
  schema?: string;
  project: Project;
  promptsByLocale: PromptsByLocale;
  /** Browser session state: undo/redo log and UI navigation. Not exported to .mlvn. */
  session?: PersistedSessionPayload;
}

export function parseStoredProjectPayload(raw: string): ProjectBundle {
  const data = JSON.parse(raw) as StoredProjectPayload | Project;

  if ("promptsByLocale" in data && data.promptsByLocale) {
    const project = parseProject(JSON.stringify(data.project));
    const defaultStoryId = getFirstStoryId(project);
    const promptsByLocale: PromptsByLocale = {};
    for (const [locale, prompts] of Object.entries(data.promptsByLocale)) {
      promptsByLocale[locale] = parseLocalePrompts(JSON.stringify(prompts), defaultStoryId);
    }
    return migrateProjectBundle(project, promptsByLocale);
  }

  const project = parseProject(raw);
  return migrateProjectBundle(project);
}

export function serializeStoredProjectPayload(
  bundle: ProjectBundle,
  session?: PersistedSessionPayload
): string {
  return JSON.stringify(
    {
      formatVersion: MUSELAB_FORMAT_VERSION,
      schema: BUNDLE_SCHEMA_ID,
      project: JSON.parse(serializeProject(bundle.project)) as Project,
      promptsByLocale: bundle.promptsByLocale,
      ...(session ? { session } : {}),
    },
    null,
    2
  );
}

export function parseStoredSessionPayload(
  data: StoredProjectPayload
): PersistedSessionPayload | undefined {
  return data.session;
}

export function serializeMlvnMetadata(): string {
  return JSON.stringify(
    {
      formatVersion: MUSELAB_FORMAT_VERSION,
      schema: MLVN_SCHEMA_ID,
      manifest: "project.json",
      promptsPattern: "prompts.{locale}.json",
    },
    null,
    2
  );
}

export function serializeProjectBundleSnapshot(bundle: ProjectBundle): string {
  const manifest = serializeProject(bundle.project);
  const promptEntries = normalizeLocales(bundle.project.locales)
    .map((locale) => {
      const prompts = bundle.promptsByLocale[locale] ?? { stories: {} };
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
  const defaultStoryId = getFirstStoryId(project);
  const promptsByLocale: PromptsByLocale = {};
  for (const [locale, promptsJson] of Object.entries(data.prompts ?? {})) {
    promptsByLocale[locale] = parseLocalePrompts(promptsJson, defaultStoryId);
  }
  return migrateProjectBundle(project, promptsByLocale);
}

export function getLocalePromptsFromMap(
  prompts: Map<string, LocalePrompts>,
  locale: string
): LocalePrompts {
  return prompts.get(locale) ?? { stories: {} };
}
