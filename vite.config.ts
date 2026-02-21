import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import path from "path";

export default defineConfig(({ mode }) => {
  const isElectron = mode === "electron";
  return {
    plugins: [
      react(),
      ...(isElectron
        ? [
            electron({
              main: { entry: "electron/main.ts" },
              preload: { input: "electron/preload.ts" },
              renderer: {},
            }),
          ]
        : []),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    base: "./",
  };
});
