import type { Locale } from "../model/types";
import { getDefaultLocaleTag, normalizeLocaleTags } from "./localeTag";

export interface PlayerLocaleContext {
  projectName: string;
  locales: Locale[] | string[];
  defaultLocale?: string;
  projectKey?: string | null;
  storedLocale?: string | null;
}

export function resolvePlayerLocale(context: PlayerLocaleContext): string {
  const locales = normalizeLocaleTags(context.locales);
  const defaultLocale = getDefaultLocaleTag(locales, context.defaultLocale);

  const stored =
    context.storedLocale ??
    readWebStoredLocale(context.projectName, context.projectKey) ??
    null;

  if (stored && locales.includes(stored)) {
    return stored;
  }
  return defaultLocale;
}

export function getStoredPlayerLocale(
  projectName: string,
  locales: Locale[] | string[],
  projectKey?: string | null,
  defaultLocale?: string
): string {
  return resolvePlayerLocale({
    projectName,
    locales,
    defaultLocale,
    projectKey,
  });
}

export function setStoredPlayerLocale(
  projectName: string,
  locale: string,
  projectKey?: string | null
): void {
  const key = storageKey(projectName, projectKey);
  try {
    localStorage.setItem(key, locale);
  } catch {
    // ignore
  }
  if (window.electronAPI?.setPlayerLocale) {
    void window.electronAPI.setPlayerLocale(projectKey ?? projectName, locale);
  }
}

function readWebStoredLocale(projectName: string, projectKey?: string | null): string | null {
  try {
    return localStorage.getItem(storageKey(projectName, projectKey));
  } catch {
    return null;
  }
}

function storageKey(projectName: string, projectKey?: string | null): string {
  const identity = projectKey?.trim() || projectName.trim() || "muselab-project";
  return `muselab-player-locale:${identity}`;
}

export async function readElectronPlayerLocale(
  projectKey: string,
  projectName: string,
  locales: Locale[] | string[],
  defaultLocale?: string
): Promise<string> {
  if (window.electronAPI?.getPlayerLocale) {
    const stored = await window.electronAPI.getPlayerLocale(projectKey);
    return resolvePlayerLocale({
      projectName,
      locales,
      defaultLocale,
      projectKey,
      storedLocale: stored,
    });
  }
  return getStoredPlayerLocale(projectName, locales, projectKey, defaultLocale);
}
