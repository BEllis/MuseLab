/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ROUTER_BASENAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_GIT_DESCRIBE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*?raw" {
  const content: string;
  export default content;
}

type OpenProjectFileResult =
  | { type: "archive"; data: Uint8Array; path: string }
  | { type: "json"; data: string; path: string };

interface Window {
  electronAPI?: {
    openFileDialog: (options: { type: "backdrop" | "actor" | "sound" | "font"; multiple?: boolean }) => Promise<string[]>;
    resolveAssetUrl: (filePath: string) => Promise<string>;
    readAssetFile: (filePath: string) => Promise<{ data: Uint8Array; mime: string }>;
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
    readAutosave?: () => Promise<string | null>;
    writeAutosave?: (payload: string) => Promise<void>;
    getPlayerLocale?: (projectKey: string) => Promise<string | null>;
    setPlayerLocale?: (projectKey: string, locale: string) => Promise<void>;
    transpileCito?: (request: {
      ciSource: string;
      target?: "js" | "cs" | "py" | "java";
    }) => Promise<{ output: string; js?: string }>;
    syncTheme?: (theme: "light" | "dark") => void;
    usesInAppMenuBar?: boolean;
    onSetTheme?: (callback: (theme: "light" | "dark") => void) => (() => void) | void;
    onShowAbout?: (callback: () => void) => (() => void) | void;
  };
  __playerPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
}
