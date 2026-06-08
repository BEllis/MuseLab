import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import path from "path";
import { execSync } from "child_process";
import { readFileSync } from "fs";

function getGitDescribe(): string {
  try {
    return execSync("git describe --always --dirty --tags", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.1";
  } catch {
    return "0.1";
  }
}

export default defineConfig(({ mode }) => {
  const isElectron = mode === "electron";
  return {
    envPrefix: ["VITE_"],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(getAppVersion()),
      "import.meta.env.VITE_GIT_DESCRIBE": JSON.stringify(getGitDescribe()),
    },
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
