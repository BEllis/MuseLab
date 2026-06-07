import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: (options: { type: "backdrop" | "actor" | "sound"; multiple?: boolean }) =>
    ipcRenderer.invoke("open-file-dialog", options),
  resolveAssetUrl: (filePath: string) =>
    ipcRenderer.invoke("resolve-asset-url", filePath),
  showSaveDialog: () => ipcRenderer.invoke("show-save-dialog") as Promise<string | null>,
  writeProjectFile: (filePath: string, json: string) =>
    ipcRenderer.invoke("write-project-file", filePath, json),
  onRequestSave: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("request-save", handler);
    return () => ipcRenderer.removeListener("request-save", handler);
  },
  onLoadProjectData: (callback: (json: string) => void) => {
    const handler = (_: unknown, json: string) => callback(json);
    ipcRenderer.on("load-project-data", handler);
    return () => ipcRenderer.removeListener("load-project-data", handler);
  },
  onRequestNew: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("request-new", handler);
    return () => ipcRenderer.removeListener("request-new", handler);
  },
  showBeforeNewDialog: () =>
    ipcRenderer.invoke("show-before-new-dialog") as Promise<0 | 1 | 2>,
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.invoke("set-window-size", width, height),
  syncTheme: (theme: "light" | "dark") => ipcRenderer.send("sync-theme", theme),
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
