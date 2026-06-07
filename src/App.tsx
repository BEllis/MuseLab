import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import DesignerView from "./views/DesignerView";
import PlayerView from "./views/PlayerView";
import { MenuBar } from "./components/MenuBar/MenuBar";
import { useProjectStore } from "./store/projectStore";
import { newProjectWithPrompt, saveProject } from "./core/project/projectFileActions";
import { isElectron } from "./utils/isElectron";
import { useThemeStore } from "./store/themeStore";
import { isAppTheme } from "./core/view/theme";
import { AboutDialog } from "./components/AboutDialog";
import { useAboutStore } from "./store/aboutStore";

function App() {
  const location = useLocation();
  const showMenuBar = !isElectron() && location.pathname !== "/play";

  useEffect(() => {
    void useProjectStore.getState().hydrateAssets();
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onRequestSave || !api?.onLoadProjectData) return;

    const removeRequestSave = api.onRequestSave(() => {
      void saveProject();
    });

    const removeLoadProjectData = api.onLoadProjectData((json) => {
      void useProjectStore.getState().loadFromJson(json);
    });

    const removeRequestNew = api.onRequestNew?.(() => {
      void newProjectWithPrompt();
    });

    const removeSetTheme = api.onSetTheme?.((theme) => {
      if (isAppTheme(theme)) {
        useThemeStore.getState().setTheme(theme);
      }
    });

    const removeShowAbout = api.onShowAbout?.(() => {
      useAboutStore.getState().show();
    });

    return () => {
      removeRequestSave?.();
      removeLoadProjectData?.();
      removeRequestNew?.();
      removeSetTheme?.();
      removeShowAbout?.();
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {showMenuBar && <MenuBar />}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Routes>
          <Route path="/" element={<DesignerView />} />
          <Route path="/play" element={<PlayerView />} />
        </Routes>
      </div>
      <AboutDialog />
    </div>
  );
}

export default App;
