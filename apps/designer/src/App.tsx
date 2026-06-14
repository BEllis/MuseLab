import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import DesignerView from "./views/DesignerView";
import PlayerView from "./views/PlayerView";
import { MenuBar } from "./components/MenuBar/MenuBar";
import { useProjectStore, bootstrapProjectStore, flushAutosave } from "./store/projectStore";
import { newProjectWithPrompt, loadProject, saveProject } from "./core/project/projectFileActions";
import { isElectron } from "./utils/isElectron";
import { useThemeStore } from "./store/themeStore";
import { isAppTheme } from "./core/view/theme";
import { AboutDialog } from "./components/AboutDialog";
import { ExportDialog } from "./components/ExportDialog/ExportDialog";
import { ScriptImportDialog } from "./components/ScriptImportDialog";
import { LoadWarningBanner } from "./components/LoadWarningBanner";
import { PwaStatusBanner } from "./components/PwaStatusBanner";
import { useAboutStore } from "./store/aboutStore";
import { runProjectEditCommand } from "./core/view/viewCommands";
import { downloadSchema } from "./core/schemas/downloadSchema";
import { getSchemaMenuEntry, type SchemaDownloadId } from "@muselab/shared/schemaMenuManifest";

function App() {
  const usesInAppMenuBar = isElectron() && Boolean(window.electronAPI?.usesInAppMenuBar);
  const showMenuBar = !isElectron() || usesInAppMenuBar;

  useEffect(() => {
    void (async () => {
      await bootstrapProjectStore();
      await useProjectStore.getState().hydrateAssets();
    })();
  }, []);

  useEffect(() => {
    const flush = () => {
      void flushAutosave();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const syncUndoRedoState = () => {
      const { canUndo, canRedo } = useProjectStore.getState();
      window.electronAPI?.syncUndoRedoState?.({ canUndo, canRedo });
    };
    syncUndoRedoState();
    return useProjectStore.subscribe(syncUndoRedoState);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        runProjectEditCommand("undo");
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        runProjectEditCommand("redo");
      }
    };
    if (isElectron() && !window.electronAPI?.usesInAppMenuBar) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onRequestSave) return;

    const removeRequestSave = api.onRequestSave(() => {
      void saveProject();
    });

    const removeRequestLoad = api.onRequestLoad?.(() => {
      void loadProject();
    });

    const removeRequestNew = api.onRequestNew?.(() => {
      void newProjectWithPrompt();
    });

    const removeRequestUndo = api.onRequestUndo?.(() => {
      runProjectEditCommand("undo");
    });

    const removeRequestRedo = api.onRequestRedo?.(() => {
      runProjectEditCommand("redo");
    });

    const removeSetTheme = api.onSetTheme?.((theme) => {
      if (isAppTheme(theme)) {
        useThemeStore.getState().setTheme(theme);
      }
    });

    const removeShowAbout = api.onShowAbout?.(() => {
      useAboutStore.getState().show();
    });

    const removeDownloadSchema = api.onDownloadSchema?.((schemaId) => {
      getSchemaMenuEntry(schemaId as SchemaDownloadId);
      downloadSchema(schemaId as SchemaDownloadId);
    });

    return () => {
      removeRequestSave?.();
      removeRequestLoad?.();
      removeRequestNew?.();
      removeRequestUndo?.();
      removeRequestRedo?.();
      removeSetTheme?.();
      removeShowAbout?.();
      removeDownloadSchema?.();
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {showMenuBar && <MenuBar />}
      {!isElectron() && <PwaStatusBanner />}
      <LoadWarningBanner />
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Routes>
          <Route path="/" element={<DesignerView />} />
          <Route path="/play" element={<PlayerView />} />
        </Routes>
      </div>
      <AboutDialog />
      <ExportDialog />
      <ScriptImportDialog />
    </div>
  );
}

export default App;
