import { useProjectStore } from "@/store/projectStore";
import { isElectron } from "@/utils/isElectron";

function downloadBlob(filename: string, data: Uint8Array, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type PickedProjectFile =
  | { type: "archive"; data: Uint8Array }
  | { type: "json"; data: string }
  | null;

function pickProjectFile(): Promise<PickedProjectFile> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mlvn,.json,application/zip,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const name = file.name.toLowerCase();
      if (name.endsWith(".mlvn") || file.type === "application/zip") {
        resolve({ type: "archive", data: new Uint8Array(await file.arrayBuffer()) });
        return;
      }

      resolve({ type: "json", data: await file.text() });
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
  const archive = await store.exportArchive();

  if (isElectron() && window.electronAPI) {
    const path = await window.electronAPI.showSaveDialog();
    if (path) {
      await window.electronAPI.writeProjectFile(path, archive);
      store.markSaved();
    }
    return;
  }

  const name = store.project.name?.trim() || "muselab-project";
  const safeName = name.replace(/[^\w.-]+/g, "_");
  downloadBlob(`${safeName}.mlvn`, archive, "application/zip");
  store.markSaved();
}

export async function loadProject(): Promise<void> {
  if (isElectron() && window.electronAPI?.openProjectFile) {
    const result = await window.electronAPI.openProjectFile();
    if (!result) return;

    if (result.type === "archive") {
      await useProjectStore.getState().loadFromArchive(result.data, result.path);
      return;
    }

    await useProjectStore.getState().loadFromJson(result.data);
    return;
  }

  const picked = await pickProjectFile();
  if (!picked) return;

  if (picked.type === "archive") {
    await useProjectStore.getState().loadFromArchive(picked.data);
    return;
  }

  await useProjectStore.getState().loadFromJson(picked.data);
}

export async function newProjectWithPrompt(): Promise<void> {
  const store = useProjectStore.getState();

  if (store.isDirty()) {
    const discard = await confirmDiscardUnsavedChanges();
    if (!discard) return;
  }

  store.newProject();
}
