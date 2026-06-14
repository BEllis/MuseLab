export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "muselab-theme";
export const DEFAULT_THEME: AppTheme = "light";
export const THEME_CHANGE_EVENT = "muselab:theme-change";

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): AppTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isAppTheme(stored)) return stored;
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
  window.electronAPI?.syncTheme?.(theme);
}

export async function initTheme(): Promise<AppTheme> {
  let theme = readStoredTheme();
  if (window.electronAPI?.getUserSettings) {
    try {
      const settings = await window.electronAPI.getUserSettings();
      if (isAppTheme(settings.theme)) {
        theme = settings.theme;
      }
    } catch {
      // fall back to localStorage/default
    }
  }
  applyTheme(theme);
  return theme;
}

export function getThemeCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
