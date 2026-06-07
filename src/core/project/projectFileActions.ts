import { useProjectStore } from "@/store/projectStore";
import { isElectron } from "@/utils/isElectron";

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pickProjectFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve(await file.text());
    };
    input.click();
  });
}

async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  if (isElectron() && window.electronAPI?.showBeforeNewDialog) {
    return window.electronAPI.showBeforeNewDialog();
  }

  return window.confirm(
    "You have unsaved changes. Start a new project anyway? Your changes will be lost."
  );
}

export async function saveProject(): Promise<void> {
  const store = useProjectStore.getState();
  const json = await store.exportJson();

  if (isElectron() && window.electronAPI) {
    const path = await window.electronAPI.showSaveDialog();
    if (path) {
      await window.electronAPI.writeProjectFile(path, json);
      store.markSaved(json);
    }
    return;
  }

  const name = store.project.name?.trim() || "muselab-project";
  const safeName = name.replace(/[^\w.-]+/g, "_");
  downloadJson(`${safeName}.json`, json);
  store.markSaved(json);
}

export async function loadProject(): Promise<void> {
  if (isElectron()) return;

  const json = await pickProjectFile();
  if (json) {
    await useProjectStore.getState().loadFromJson(json);
  }
}

export async function newProjectWithPrompt(): Promise<void> {
  const store = useProjectStore.getState();

  if (store.isDirty()) {
    const discard = await confirmDiscardUnsavedChanges();
    if (!discard) return;
  }

  store.newProject();
}
