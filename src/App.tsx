import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import DesignerView from "./views/DesignerView";
import PlayerView from "./views/PlayerView";
import { useProjectStore } from "./store/projectStore";

function App() {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onRequestSave || !api?.showSaveDialog || !api?.writeProjectFile || !api?.onLoadProjectData) return;

    const removeRequestSave = api.onRequestSave(async () => {
      const store = useProjectStore.getState();
      const json = store.exportJson();
      const path = await api.showSaveDialog();
      if (path) {
        await api.writeProjectFile(path, json);
        store.markSaved(json);
      }
    });

    const removeLoadProjectData = api.onLoadProjectData((json) => {
      useProjectStore.getState().loadFromJson(json);
    });

    const removeRequestNew = api.onRequestNew?.(async () => {
      const store = useProjectStore.getState();
      if (!store.isDirty()) {
        store.newProject();
        return;
      }
      const choice = await api.showBeforeNewDialog?.();
      if (choice === 2) return; // Cancel
      if (choice === 1) {
        store.newProject();
        return;
      }
      // choice === 0: Save
      const json = store.exportJson();
      const path = await api.showSaveDialog();
      if (path) {
        await api.writeProjectFile(path, json);
        store.markSaved(json);
        store.newProject();
      }
    });

    return () => {
      removeRequestSave?.();
      removeLoadProjectData?.();
      removeRequestNew?.();
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<DesignerView />} />
      <Route path="/play" element={<PlayerView />} />
    </Routes>
  );
}

export default App;
