import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CitoWasmSplash } from "./components/CitoWasmSplash";
import {
  initCitoWasm,
  isCitoWasmRequired,
  type CitoWasmLoadProgress,
} from "./core/cito/citoWasmLoader";
import { initTheme } from "./core/view/theme";
import { useThemeStore } from "./store/themeStore";
import logoUrl from "./assets/logo.png";
import "./index.css";

const initialProgress: CitoWasmLoadProgress = {
  phase: "config",
  loaded: 0,
  total: 1,
  label: "Preparing MuseLab…",
};

async function bootstrap() {
  const theme = await initTheme();
  useThemeStore.setState({ theme });

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("Missing #root element");
  }

  if (isCitoWasmRequired()) {
    const splashRoot = createRoot(rootEl);
    let progress = initialProgress;
    let error: string | null = null;

    const renderSplash = () => {
      splashRoot.render(
        <CitoWasmSplash progress={progress} error={error} logoUrl={logoUrl} />
      );
    };

    renderSplash();

    try {
      await initCitoWasm((next) => {
        progress = next;
        renderSplash();
      });
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
      renderSplash();
      return;
    }

    splashRoot.unmount();
  }

  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // WASM cannot be re-initialized after Vite HMR; a full reload is required.
    window.location.reload();
  });
}

void bootstrap();
