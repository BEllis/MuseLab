import { contextBridge, ipcRenderer } from "electron";

export type OpenProjectFileResult =
  | { type: "archive"; data: Uint8Array; path: string }
  | { type: "json"; data: string; path: string };

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: (options: { type: "backdrop" | "actor" | "sound" | "font"; multiple?: boolean }) =>
    ipcRenderer.invoke("open-file-dialog", options),
  resolveAssetUrl: (filePath: string) =>
    ipcRenderer.invoke("resolve-asset-url", filePath),
  readAssetFile: (filePath: string) =>
    ipcRenderer.invoke("read-asset-file", filePath) as Promise<{ data: Uint8Array; mime: string }>,
  showSaveDialog: () => ipcRenderer.invoke("show-save-dialog") as Promise<string | null>,
  openProjectFile: () => ipcRenderer.invoke("open-project-file") as Promise<OpenProjectFileResult | null>,
  writeProjectFile: (filePath: string, data: Uint8Array) =>
    ipcRenderer.invoke("write-project-file", filePath, data),
  extractArchiveAssets: (
    cacheKey: string,
    entries: { relativePath: string; data: Uint8Array }[]
  ) => ipcRenderer.invoke("extract-archive-assets", cacheKey, entries) as Promise<string>,
  onRequestSave: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("request-save", handler);
    return () => ipcRenderer.removeListener("request-save", handler);
  },
  onRequestLoad: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("request-load", handler);
    return () => ipcRenderer.removeListener("request-load", handler);
  },
  onLoadProjectData: (callback: (data: Uint8Array | string) => void) => {
    const handler = (_: unknown, data: Uint8Array | string) => callback(data);
    ipcRenderer.on("load-project-data", handler);
    return () => ipcRenderer.removeListener("load-project-data", handler);
  },
  onRequestNew: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("request-new", handler);
    return () => ipcRenderer.removeListener("request-new", handler);
  },
  onRequestUndo: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("request-undo", handler);
    return () => ipcRenderer.removeListener("request-undo", handler);
  },
  onRequestRedo: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("request-redo", handler);
    return () => ipcRenderer.removeListener("request-redo", handler);
  },
  syncUndoRedoState: (state: { canUndo: boolean; canRedo: boolean }) =>
    ipcRenderer.send("sync-undo-redo-state", state),
  showBeforeNewDialog: () =>
    ipcRenderer.invoke("show-before-new-dialog") as Promise<0 | 1 | 2>,
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.invoke("set-window-size", width, height),
  getUserSettings: () =>
    ipcRenderer.invoke("get-user-settings") as Promise<{ theme?: "light" | "dark" }>,
  readAutosave: () => ipcRenderer.invoke("read-autosave") as Promise<string | null>,
  writeAutosave: (payload: string) => ipcRenderer.invoke("write-autosave", payload) as Promise<void>,
  getPlayerLocale: (projectKey: string) =>
    ipcRenderer.invoke("get-player-locale", projectKey) as Promise<string | null>,
  setPlayerLocale: (projectKey: string, locale: string) =>
    ipcRenderer.invoke("set-player-locale", projectKey, locale) as Promise<void>,
  transpileCito: (request: { ciSource: string }) =>
    ipcRenderer.invoke("cito:transpile", request) as Promise<{ js: string }>,
  syncTheme: (theme: "light" | "dark") => ipcRenderer.send("sync-theme", theme),
  usesInAppMenuBar: process.platform === "linux",
  onSetTheme: (callback: (theme: "light" | "dark") => void) => {
    const handler = (_: unknown, theme: "light" | "dark") => callback(theme);
    ipcRenderer.on("set-theme", handler);
    return () => ipcRenderer.removeListener("set-theme", handler);
  },
  onShowAbout: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("show-about", handler);
    return () => ipcRenderer.removeListener("show-about", handler);
  },
});
