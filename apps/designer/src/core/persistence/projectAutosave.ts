import type { Project } from "@/core/model/types";
import {
  migrateProjectBundle,
  parseStoredProjectPayload,
  serializeStoredProjectPayload,
  type ProjectBundle,
} from "@/core/model/projectBundle";
import {
  emptyStoredSession,
  parseSessionFromStorage,
  serializeSessionForStorage,
  type StoredProjectSession,
} from "@/core/events/persistedSession";
import { getFirstStoryId } from "@/core/model/project";
import { parseAspectRatio } from "@/core/view/thumbnailAspectRatio";
import { validateStoredProjectJson } from "@/core/project/loadValidation";
import { isElectron } from "@/utils/isElectron";

/** Plain JSON autosave in localStorage (web) or userData/autosave.json (Electron). */
export const AUTOSAVE_STORAGE_KEY = "muselab-project";

const LEGACY_THUMBNAIL_ASPECT_RATIO_STORAGE_KEY = "muselab-thumbnail-aspect-ratio";

export type LoadedAutosave = {
  bundle: ReturnType<typeof migrateProjectBundle>;
  session: StoredProjectSession | null;
  loadWarnings: string[];
  raw: string;
};

export type AutosavePersistState = {
  bundle: ProjectBundle;
  session: StoredProjectSession;
};

export function serializeAutosavePayload(state: AutosavePersistState): string {
  return serializeStoredProjectPayload(state.bundle, serializeSessionForStorage(state.session));
}

export function parseAutosavePayload(raw: string): LoadedAutosave {
  const loadWarnings = validateStoredProjectJson(raw);
  const data = JSON.parse(raw) as { session?: unknown };
  const bundle = parseStoredProjectPayload(raw);
  const parsedSession = parseSessionFromStorage(data.session);
  return {
    bundle,
    session: parsedSession,
    loadWarnings,
    raw,
  };
}

export function loadAutosaveFromLocalStorage(): LoadedAutosave | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    return parseAutosavePayload(raw);
  } catch {
    return null;
  }
}

export async function loadAutosaveFromPersistence(): Promise<LoadedAutosave | null> {
  if (isElectron() && window.electronAPI?.readAutosave) {
    const raw = await window.electronAPI.readAutosave();
    if (raw) {
      try {
        return parseAutosavePayload(raw);
      } catch {
        return null;
      }
    }
    const legacy = loadAutosaveFromLocalStorage();
    if (legacy) {
      await saveAutosaveToPersistence({
        bundle: legacy.bundle,
        session: legacy.session ?? emptyStoredSession(getFirstStoryId(legacy.bundle.project)),
      });
      try {
        localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return legacy;
  }
  return loadAutosaveFromLocalStorage();
}

export async function saveAutosaveToPersistence(state: AutosavePersistState): Promise<void> {
  const payload = serializeAutosavePayload(state);
  if (isElectron() && window.electronAPI?.writeAutosave) {
    await window.electronAPI.writeAutosave(payload);
    return;
  }
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, payload);
  } catch {
    // ignore quota errors
  }
}

export function readLegacyThumbnailAspectRatio(project: Project): void {
  if (project.thumbnailAspectRatio) return;
  try {
    const raw = localStorage.getItem(LEGACY_THUMBNAIL_ASPECT_RATIO_STORAGE_KEY);
    if (!raw) return;
    const parsed = parseAspectRatio(JSON.parse(raw));
    if (parsed) project.thumbnailAspectRatio = parsed;
  } catch {
    // ignore
  }
}
