import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initTheme } from "./core/view/theme";
import { useThemeStore } from "./store/themeStore";
import "./index.css";

async function bootstrap() {
  const theme = await initTheme();
  useThemeStore.setState({ theme });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

void bootstrap();
