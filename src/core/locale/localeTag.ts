export const DEFAULT_LOCALES = ["en"] as const;

const LOCALE_TAG_PATTERN = /^[a-z]+(?:-[a-z]+)*$/;

export function isValidLocaleTag(value: string): boolean {
  return LOCALE_TAG_PATTERN.test(value);
}

export function normalizeLocaleTag(value: string): string {
  return value.trim().toLowerCase();
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

function sortLocaleTags(locales: string[]): string[] {
  return [...locales].sort((a, b) => a.localeCompare(b));
}

export function normalizeLocales(locales: string[] | undefined): string[] {
  if (!locales || locales.length === 0) {
    return [...DEFAULT_LOCALES];
  }
  const normalized: string[] = [];
  for (const locale of locales) {
    const tag = assertValidLocaleTag(locale);
    if (!normalized.includes(tag)) {
      normalized.push(tag);
    }
  }
  if (normalized.length === 0) {
    return [...DEFAULT_LOCALES];
  }
  return sortLocaleTags(normalized);
}

export function getDefaultLocaleTag(
  locales: string[] | undefined,
  defaultLocale?: string
): string {
  const normalized = normalizeLocales(locales);
  if (defaultLocale) {
    const tag = assertValidLocaleTag(defaultLocale);
    if (normalized.includes(tag)) {
      return tag;
    }
  }
  return normalized[0] ?? DEFAULT_LOCALES[0];
}

/** Preserve legacy default (pre-sort first entry) and ensure defaultLocale is valid. */
export function migrateProjectDefaultLocale(project: {
  locales: string[];
  defaultLocale?: string;
}): void {
  const legacyDefault = project.locales[0];
  project.locales = normalizeLocales(project.locales);

  if (project.defaultLocale) {
    try {
      const tag = assertValidLocaleTag(project.defaultLocale);
      if (project.locales.includes(tag)) {
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
      if (project.locales.includes(tag)) {
        project.defaultLocale = tag;
        return;
      }
    } catch {
      // fall through
    }
  }

  project.defaultLocale = project.locales[0];
}

export function parseLocaleFromPromptsFileName(fileName: string): string | null {
  const match = fileName.match(/^prompts\.([a-z]+(?:-[a-z]+)*)\.json$/);
  if (!match) return null;
  const locale = match[1];
  return isValidLocaleTag(locale) ? locale : null;
}
