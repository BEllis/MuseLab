/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_GIT_DESCRIBE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type OpenProjectFileResult =
  | { type: "archive"; data: Uint8Array; path: string }
  | { type: "json"; data: string; path: string };

interface Window {
  electronAPI?: {
    openFileDialog: (options: { type: "backdrop" | "actor" | "sound"; multiple?: boolean }) => Promise<string[]>;
    resolveAssetUrl: (filePath: string) => Promise<string>;
    showSaveDialog: () => Promise<string | null>;
    openProjectFile: () => Promise<OpenProjectFileResult | null>;
    writeProjectFile: (filePath: string, data: Uint8Array) => Promise<void>;
    extractArchiveAssets: (
      cacheKey: string,
      entries: { relativePath: string; data: Uint8Array }[]
    ) => Promise<string>;
    onRequestSave: (callback: () => void) => (() => void) | void;
    onRequestLoad?: (callback: () => void) => (() => void) | void;
    onLoadProjectData?: (callback: (data: Uint8Array | string) => void) => (() => void) | void;
    onRequestNew?: (callback: () => void) => (() => void) | void;
    onRequestUndo?: (callback: () => void) => (() => void) | void;
    onRequestRedo?: (callback: () => void) => (() => void) | void;
    syncUndoRedoState?: (state: { canUndo: boolean; canRedo: boolean }) => void;
    showBeforeNewDialog?: () => Promise<boolean>;
    setWindowSize?: (width: number, height: number) => Promise<void>;
    getUserSettings?: () => Promise<{ theme?: "light" | "dark" }>;
    syncTheme?: (theme: "light" | "dark") => void;
    usesInAppMenuBar?: boolean;
    onSetTheme?: (callback: (theme: "light" | "dark") => void) => (() => void) | void;
    onShowAbout?: (callback: () => void) => (() => void) | void;
  };
  __playerPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
}
