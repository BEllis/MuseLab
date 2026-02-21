/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    openFileDialog: (options: { type: "backdrop" | "actor" | "sound"; multiple?: boolean }) => Promise<string[]>;
    resolveAssetUrl: (filePath: string) => Promise<string>;
    showSaveDialog: () => Promise<string | null>;
    writeProjectFile: (filePath: string, json: string) => Promise<void>;
    onRequestSave: (callback: () => void) => (() => void) | void;
    onLoadProjectData: (callback: (json: string) => void) => (() => void) | void;
    onRequestNew?: (callback: () => void) => (() => void) | void;
    showBeforeNewDialog?: () => Promise<0 | 1 | 2>;
    setWindowSize?: (width: number, height: number) => Promise<void>;
  };
  __playerPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
}
