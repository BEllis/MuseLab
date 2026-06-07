/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_GIT_DESCRIBE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electronAPI?: {
    openFileDialog: (options: { type: "backdrop" | "actor" | "sound"; multiple?: boolean }) => Promise<string[]>;
    resolveAssetUrl: (filePath: string) => Promise<string>;
    showSaveDialog: () => Promise<string | null>;
    writeProjectFile: (filePath: string, json: string) => Promise<void>;
    onRequestSave: (callback: () => void) => (() => void) | void;
    onLoadProjectData: (callback: (json: string) => void) => (() => void) | void;
    onRequestNew?: (callback: () => void) => (() => void) | void;
    showBeforeNewDialog?: () => Promise<boolean>;
    setWindowSize?: (width: number, height: number) => Promise<void>;
    syncTheme?: (theme: "light" | "dark") => void;
    onSetTheme?: (callback: (theme: "light" | "dark") => void) => (() => void) | void;
    onShowAbout?: (callback: () => void) => (() => void) | void;
  };
  __playerPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
}
