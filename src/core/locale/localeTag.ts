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
  return normalized;
}

export function parseLocaleFromPromptsFileName(fileName: string): string | null {
  const match = fileName.match(/^prompts\.([a-z]+(?:-[a-z]+)*)\.json$/);
  if (!match) return null;
  const locale = match[1];
  return isValidLocaleTag(locale) ? locale : null;
}
