import { app } from "electron";
import path from "path";
import { readFile, writeFile, mkdir } from "fs/promises";

export type AppTheme = "light" | "dark";

export interface UserSettings {
  theme?: AppTheme;
}

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function parseSettings(raw: string): UserSettings {
  const data = JSON.parse(raw) as UserSettings;
  if (data.theme !== "light" && data.theme !== "dark") {
    return {};
  }
  return { theme: data.theme };
}

export async function loadUserSettings(): Promise<UserSettings> {
  try {
    const raw = await readFile(settingsPath(), "utf8");
    return parseSettings(raw);
  } catch {
    return {};
  }
}

export async function saveUserSettings(patch: UserSettings): Promise<UserSettings> {
  const current = await loadUserSettings();
  const next: UserSettings = { ...current, ...patch };
  await mkdir(path.dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function resolveStartupTheme(): Promise<AppTheme> {
  const settings = await loadUserSettings();
  return settings.theme === "dark" ? "dark" : "light";
}
