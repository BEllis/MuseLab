import { useProjectStore } from "@/store/projectStore";
import { validateAllStories } from "@/core/model/graphHierarchy";
import { getPlayValidationMessage } from "@/core/model/playValidationMessage";
import { isElectron } from "@/utils/isElectron";
import { exportProject, type ExportProjectOptions } from "./exportProject";
import { exportArchiveFileName } from "./packExportArchive";

function downloadBlob(filename: string, data: Uint8Array, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function runProjectExport(options: ExportProjectOptions): Promise<void> {
  const store = useProjectStore.getState();
  const validationFailure = validateAllStories(store.project.stories);
  if (validationFailure) {
    const message = `Cannot export: story "${validationFailure.storyName}" — ${getPlayValidationMessage(validationFailure.validation)}`;
    window.alert(message);
    return;
  }

  const bundle = {
    project: store.project,
    promptsByLocale: store.promptsByLocale,
  };
  const archive = await exportProject(bundle, options);
  const filename = exportArchiveFileName(store.project.name, options.target);

  if (isElectron() && window.electronAPI?.showSaveDialog) {
    const path = await window.electronAPI.showSaveDialog();
    if (path && window.electronAPI.writeProjectFile) {
      await window.electronAPI.writeProjectFile(path, archive);
    }
    return;
  }

  downloadBlob(filename, archive, "application/zip");
}
