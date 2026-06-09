import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { VitePWA } from "vite-plugin-pwa";
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

function buildVersionPayload(): string {
  return JSON.stringify(
    {
      version: getAppVersion(),
      gitDescribe: getGitDescribe(),
    },
    null,
    2
  );
}

function versionJsonPlugin(): Plugin {
  return {
    name: "version-json",
    configureServer(server) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(buildVersionPayload());
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: buildVersionPayload(),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isElectron = mode === "electron";
  const isWebDeploy = mode === "web-deploy";
  const define: Record<string, string> = {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(getAppVersion()),
  };

  if (isWebDeploy) {
    define["import.meta.env.VITE_ROUTER_BASENAME"] = JSON.stringify("/app");
  }

  if (isElectron) {
    define["import.meta.env.VITE_GIT_DESCRIBE"] = JSON.stringify(getGitDescribe());
  }

  return {
    envPrefix: ["VITE_"],
    define,
    plugins: [
      react(),
      ...(isElectron
        ? []
        : [versionJsonPlugin()]),
      ...(!isElectron
        ? [
            VitePWA(
              isWebDeploy
                ? {
                    registerType: "prompt",
                    injectRegister: false,
                    scope: "/app/",
                    workbox: {
                      globPatterns: [
                        "**/*.{js,css,html,ico,png,svg,wasm,json,dat,blat,bin,woff2}",
                        "cito-wasm/**/*",
                      ],
                      navigateFallback: "index.html",
                      navigateFallbackDenylist: [/^\/cito-wasm\//],
                      maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
                    },
                    manifest: {
                      name: "MuseLab",
                      short_name: "MuseLab",
                      description: "Visual novel designer",
                      start_url: "/app/",
                      scope: "/app/",
                      display: "standalone",
                      background_color: "#1a1a1a",
                      theme_color: "#1a1a1a",
                      icons: [
                        {
                          src: "pwa-192.png",
                          sizes: "192x192",
                          type: "image/png",
                        },
                        {
                          src: "pwa-512.png",
                          sizes: "512x512",
                          type: "image/png",
                        },
                        {
                          src: "pwa-512.png",
                          sizes: "512x512",
                          type: "image/png",
                          purpose: "maskable",
                        },
                      ],
                    },
                    devOptions: { enabled: false },
                  }
                : {
                    registerType: "prompt",
                    injectRegister: false,
                    devOptions: { enabled: false },
                  }
            ),
          ]
        : []),
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
    base: isWebDeploy ? "/app/" : "./",
  };
});
