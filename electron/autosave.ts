import { app } from "electron";
import path from "path";
import { rename, writeFile, mkdir, readFile, unlink } from "fs/promises";

const AUTOSAVE_FILENAME = "autosave.json";
const AUTOSAVE_TMP_FILENAME = "autosave.json.tmp";

function autosavePath(): string {
  return path.join(app.getPath("userData"), AUTOSAVE_FILENAME);
}

function autosaveTmpPath(): string {
  return path.join(app.getPath("userData"), AUTOSAVE_TMP_FILENAME);
}

/**
 * Single JSON document: { project, promptsByLocale, session: { eventLog, ... } }.
 *
 * We use JSON rather than JSONL because autosave is a snapshot of mutable state:
 * undo truncates the future branch, coalescing replaces the last event, and the
 * project bundle is rewritten on every save. JSONL append-only fits audit/sync
 * logs, not a cursor-based undo log that must be rewritten atomically.
 */
export async function readAutosaveFile(): Promise<string | null> {
  try {
    return await readFile(autosavePath(), "utf8");
  } catch {
    return null;
  }
}

export async function writeAutosaveFile(payload: string): Promise<void> {
  const dir = path.dirname(autosavePath());
  await mkdir(dir, { recursive: true });
  const tmpPath = autosaveTmpPath();
  const finalPath = autosavePath();
  await writeFile(tmpPath, payload, "utf8");
  try {
    await unlink(finalPath);
  } catch {
    // file may not exist yet
  }
  await rename(tmpPath, finalPath);
}

export async function clearAutosaveFile(): Promise<void> {
  try {
    await unlink(autosavePath());
  } catch {
    // ignore
  }
}
