import { useProjectStore } from "@/store/projectStore";
import { useScriptImportDialogStore } from "@/store/scriptImportDialogStore";
import { isElectron } from "@/utils/isElectron";
import {
  parseScriptText,
  scriptFileName,
  serializeScriptJson,
  serializeScriptYaml,
} from "./parseScript";
import type { ImportScriptMode, MuseLabScriptDocument } from "./types";

function downloadText(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pickScriptFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mls.yaml,.mls.json,.yaml,.yml,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve({ name: file.name, text: await file.text() });
    };
    input.click();
  });
}

function chooseImportMode(): ImportScriptMode | null {
  const merge = window.confirm(
    "Import script in MERGE mode?\n\nOK = Merge (upsert scenes from script, keep unmentioned scenes)\nCancel = Replace (rebuild story from script only)"
  );
  return merge ? "merge" : "replace";
}

function formatImportFailure(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : ["Unknown error"];
}

async function writeScriptFile(filename: string, text: string): Promise<void> {
  const data = new TextEncoder().encode(text);
  if (isElectron() && window.electronAPI?.showSaveDialog && window.electronAPI.writeProjectFile) {
    const path = await window.electronAPI.showSaveDialog();
    if (path) {
      await window.electronAPI.writeProjectFile(path, data);
    }
    return;
  }
  const mimeType = filename.endsWith(".json")
    ? "application/json"
    : "application/x-yaml";
  downloadText(filename, text, mimeType);
}

export async function exportActiveStoryScript(format: "yaml" | "json" = "yaml"): Promise<void> {
  const store = useProjectStore.getState();
  const storyId = store.selectedStoryId ?? store.activeStoryId;
  const script = store.exportStoryScript(storyId);
  const story = store.project.stories.find((entry) => entry.id === storyId);
  const filename = scriptFileName(story?.name ?? "story", format);
  const text =
    format === "yaml" ? serializeScriptYaml(script) : serializeScriptJson(script);
  await writeScriptFile(filename, text);
}

export async function exportProjectScriptFile(format: "yaml" | "json" = "yaml"): Promise<void> {
  const store = useProjectStore.getState();
  const script = store.exportProjectScript();
  const filename = scriptFileName(store.project.name, format);
  const text =
    format === "yaml" ? serializeScriptYaml(script) : serializeScriptJson(script);
  await writeScriptFile(filename, text);
}

export async function exportScriptWithScope(): Promise<void> {
  await exportProjectScriptFile("yaml");
}

export async function importScriptFile(targetStoryId: string | null = null): Promise<void> {
  const dialog = useScriptImportDialogStore.getState();
  const picked = await pickScriptFile();
  if (!picked) return;

  let document: MuseLabScriptDocument;
  try {
    document = parseScriptText(picked.text, picked.name);
  } catch (error) {
    dialog.showFailure(formatImportFailure(error));
    return;
  }

  const mode = chooseImportMode();
  if (!mode) return;

  const store = useProjectStore.getState();
  try {
    store.beginHistoryTransaction();
    const notes = store.importScriptDocument(document, mode, targetStoryId);
    store.commitHistoryTransaction();
    dialog.showSuccess(notes);
  } catch (error) {
    store.cancelHistoryTransaction();
    dialog.showFailure(formatImportFailure(error));
  }
}

export async function importStoryScriptFile(storyId: string): Promise<void> {
  await importScriptFile(storyId);
}
