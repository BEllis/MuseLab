import type { Locale } from "../model/types";
import { generateId, isUuid } from "../model/id";

export const DEFAULT_LOCALES = ["en"] as const;
export const LOCALE_CODE_MAX_LENGTH = 5;

const LOCALE_TAG_PATTERN = /^[a-z]+(?:-[a-z]+)*$/;

export function isValidLocaleTag(value: string): boolean {
  return LOCALE_TAG_PATTERN.test(value);
}

export function normalizeLocaleTag(value: string): string {
  return value.trim().toLowerCase();
}

/** Restrict live locale code input to lowercase letters, hyphens, and max length. */
export function sanitizeLocaleCodeInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z-]/g, "")
    .slice(0, LOCALE_CODE_MAX_LENGTH);
}

export function assertValidLocaleTag(value: string): string {
  const normalized = normalizeLocaleTag(value);
  if (!isValidLocaleTag(normalized)) {
    throw new Error(
      `Invalid locale tag "${value}": use lowercase letters and hyphens only, with no leading or trailing hyphen`
    );
  }
  return normalized;
}

export function createLocale(tag: string, displayName?: string, id?: string): Locale {
  const locale = assertValidLocaleTag(tag);
  const trimmedDisplayName = displayName?.trim();
  return {
    id: id && isUuid(id) ? id : generateId(),
    locale,
    displayName: trimmedDisplayName || locale,
  };
}

function isLocaleObject(value: unknown): value is Locale {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Locale).id === "string" &&
    typeof (value as Locale).locale === "string" &&
    typeof (value as Locale).displayName === "string"
  );
}

function sortLocales(locales: Locale[]): Locale[] {
  return [...locales].sort((a, b) => a.locale.localeCompare(b.locale));
}

export function normalizeLocales(input: Locale[] | string[] | undefined): Locale[] {
  if (!input || input.length === 0) {
    return [createLocale(DEFAULT_LOCALES[0])];
  }

  const byTag = new Map<string, Locale>();
  for (const entry of input) {
    if (isLocaleObject(entry)) {
      const tag = assertValidLocaleTag(entry.locale);
      const displayName = entry.displayName.trim() || tag;
      if (!byTag.has(tag)) {
        byTag.set(tag, {
          id: isUuid(entry.id) ? entry.id : generateId(),
          locale: tag,
          displayName,
        });
      }
      continue;
    }

    if (typeof entry === "string") {
      const tag = assertValidLocaleTag(entry);
      if (!byTag.has(tag)) {
        byTag.set(tag, createLocale(tag));
      }
      continue;
    }

    throw new Error("Invalid locale entry");
  }

  if (byTag.size === 0) {
    return [createLocale(DEFAULT_LOCALES[0])];
  }

  return sortLocales([...byTag.values()]);
}

export function getLocaleTags(locales: Locale[]): string[] {
  return locales.map((entry) => entry.locale);
}

export function normalizeLocaleTags(input: Locale[] | string[] | undefined): string[] {
  return getLocaleTags(normalizeLocales(input));
}

export function hasLocaleTag(locales: Locale[], tag: string): boolean {
  const normalized = assertValidLocaleTag(tag);
  return locales.some((entry) => entry.locale === normalized);
}

export function findLocaleByTag(locales: Locale[], tag: string): Locale | undefined {
  const normalized = assertValidLocaleTag(tag);
  return locales.find((entry) => entry.locale === normalized);
}

export function findLocaleById(locales: Locale[], localeId: string): Locale | undefined {
  return locales.find((entry) => entry.id === localeId);
}

export function getDefaultLocaleTag(
  locales: Locale[] | string[] | undefined,
  defaultLocale?: string
): string {
  const tags = normalizeLocaleTags(locales);
  if (defaultLocale) {
    const tag = assertValidLocaleTag(defaultLocale);
    if (tags.includes(tag)) {
      return tag;
    }
  }
  return tags[0] ?? DEFAULT_LOCALES[0];
}

/** Preserve legacy default (pre-sort first entry) and ensure defaultLocale is valid. */
export function migrateProjectDefaultLocale(project: {
  locales: Locale[] | string[];
  defaultLocale?: string;
}): void {
  const firstEntry = project.locales[0];
  const legacyDefault = typeof firstEntry === "string" ? firstEntry : firstEntry?.locale;
  project.locales = normalizeLocales(project.locales);

  if (project.defaultLocale) {
    try {
      const tag = assertValidLocaleTag(project.defaultLocale);
      if (hasLocaleTag(project.locales, tag)) {
        project.defaultLocale = tag;
        return;
      }
    } catch {
      // fall through
    }
  }

  if (legacyDefault) {
    try {
      const tag = assertValidLocaleTag(legacyDefault);
      if (hasLocaleTag(project.locales, tag)) {
        project.defaultLocale = tag;
        return;
      }
    } catch {
      // fall through
    }
  }

  project.defaultLocale = project.locales[0]?.locale ?? DEFAULT_LOCALES[0];
}

export function parseLocaleFromPromptsFileName(fileName: string): string | null {
  const match = fileName.match(/^prompts\.([a-z]+(?:-[a-z]+)*)\.json$/);
  if (!match) return null;
  const locale = match[1];
  return isValidLocaleTag(locale) ? locale : null;
}
