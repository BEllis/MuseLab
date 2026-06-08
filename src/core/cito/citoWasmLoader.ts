import { isElectron } from "@/utils/isElectron";

export type CitoWasmLoadProgress = {
  phase: "config" | "runtime" | "assemblies" | "init";
  loaded: number;
  total: number;
  label: string;
};

type MonoAsset = {
  name: string;
  behavior: string;
  virtual_path?: string;
  load_remote?: boolean;
  is_optional?: boolean;
  culture?: string;
};

type MonoConfig = {
  assembly_root: string;
  debug_level: number;
  assets: MonoAsset[];
  remote_sources: string[];
};

type DotNetModule = {
  onRuntimeInitialized?: () => void;
  locateFile?: (path: string, prefix?: string) => string;
  print?: (message: string) => void;
  printErr?: (message: string) => void;
};

type DotNetBinding = {
  bind_static_method: (fqn: string, signature?: string) => (ciSource: string) => string;
};

type DotNetMono = {
  mono_load_runtime_and_bcl_args: (args: Record<string, unknown>) => void;
  mono_wasm_runtime_is_ready?: boolean;
  loaded_files?: string[];
};

declare global {
  interface Window {
    Module?: DotNetModule;
    BINDING?: DotNetBinding;
    MONO?: DotNetMono;
  }
}

const TRANSPILER_METHOD = "[cito-wasm] Foxoft.Ci.TranspileLib:TranspileJs";

let transpileFn: ((ciSource: string) => string) | null = null;
let initPromise: Promise<void> | null = null;

function citoWasmBaseUrl(): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${base.endsWith("/") ? "" : "/"}cito-wasm/`;
}

function resolveWasmAssetUrl(base: string, assetUrl: string): string {
  if (/^https?:\/\//i.test(assetUrl) || assetUrl.startsWith("blob:")) {
    return assetUrl;
  }
  return `${base}${assetUrl}`;
}

function reportProgress(
  onProgress: ((progress: CitoWasmLoadProgress) => void) | undefined,
  progress: CitoWasmLoadProgress
): void {
  onProgress?.(progress);
}

function loadDotNetScript(src: string): Promise<void> {
  const existing = document.querySelector('script[data-cito-wasm="dotnet"]');
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.citoWasm = "dotnet";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function bindTranspileMethod(): (ciSource: string) => string {
  const binding = window.BINDING;
  if (!binding) {
    throw new Error("Cito WASM runtime failed to initialize (BINDING missing).");
  }
  return binding.bind_static_method(TRANSPILER_METHOD);
}

export function isCitoWasmRequired(): boolean {
  return !isElectron();
}

export async function initCitoWasm(
  onProgress?: (progress: CitoWasmLoadProgress) => void
): Promise<void> {
  if (isElectron()) return;
  if (transpileFn) return;
  if (initPromise) return initPromise;

  if (window.MONO && !window.MONO.mono_wasm_runtime_is_ready && !transpileFn) {
    throw new Error("Cito WASM runtime is in a bad state. Reload the page and try again.");
  }

  if (window.MONO?.mono_wasm_runtime_is_ready) {
    try {
      transpileFn = bindTranspileMethod();
      return;
    } catch {
      // Fall through and rebuild runtime state on a fresh load.
    }
  }

  initPromise = (async () => {
    const base = citoWasmBaseUrl();

    reportProgress(onProgress, {
      phase: "config",
      loaded: 0,
      total: 1,
      label: "Loading transpiler configuration…",
    });

    const configResponse = await fetch(`${base}mono-config.json`, { credentials: "same-origin" });
    if (!configResponse.ok) {
      throw new Error(
        "Cito WASM bundle not found. Run npm run build:cito-wasm before using the web app."
      );
    }
    const config = (await configResponse.json()) as MonoConfig;

    reportProgress(onProgress, {
      phase: "config",
      loaded: 1,
      total: 1,
      label: "Downloading Cito transpiler runtime…",
    });

    reportProgress(onProgress, {
      phase: "runtime",
      loaded: 0,
      total: 1,
      label: "Starting .NET WebAssembly runtime…",
    });

    window.Module = {
      locateFile: (path) => `${base}${path}`,
      print: (message) => {
        if (import.meta.env.DEV) console.debug("[cito-wasm]", message);
      },
      printErr: (message) => console.error("[cito-wasm]", message),
    };

    await loadDotNetScript(`${base}dotnet.js`);

    const mono = window.MONO;
    if (!mono) {
      throw new Error("Cito WASM runtime failed to initialize (MONO missing).");
    }

    const assemblyTotal = config.assets.filter((asset) => asset.behavior === "assembly").length;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      let progressTimer = 0;
      const finish = () => {
        if (settled) return;
        window.clearInterval(progressTimer);
        try {
          transpileFn = bindTranspileMethod();
          reportProgress(onProgress, {
            phase: "init",
            loaded: 1,
            total: 1,
            label: "Ready",
          });
          settled = true;
          resolve();
        } catch (error) {
          fail(error);
        }
      };

      progressTimer = window.setInterval(() => {
        const loaded = window.MONO?.loaded_files?.length ?? 0;
        reportProgress(onProgress, {
          phase: "assemblies",
          loaded: Math.min(loaded, assemblyTotal),
          total: assemblyTotal,
          label: "Downloading Cito transpiler assemblies…",
        });
      }, 100);

      mono.mono_load_runtime_and_bcl_args({
        assembly_root: config.assembly_root,
        assets: config.assets,
        remote_sources: config.remote_sources ?? [],
        debug_level: config.debug_level,
        globalization_mode: "invariant",
        fetch_file_cb: (assetUrl: string) =>
          window.fetch(resolveWasmAssetUrl(base, assetUrl), { credentials: "same-origin" }),
        loaded_cb: finish,
      });

      window.setTimeout(() => {
        window.clearInterval(progressTimer);
        if (settled) return;
        if (window.MONO?.mono_wasm_runtime_is_ready) {
          finish();
          return;
        }
        fail(new Error("Timed out waiting for the Cito WASM transpiler to start."));
      }, 180_000);
    });
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}

export async function transpileCiSourceWithWasm(ciSource: string): Promise<string> {
  if (isElectron()) {
    throw new Error("transpileCiSourceWithWasm is only available on web.");
  }
  await initCitoWasm();
  if (!transpileFn) {
    throw new Error("Cito WASM transpiler is not initialized.");
  }
  return transpileFn(ciSource);
}

export function resetCitoWasmForTests(): void {
  transpileFn = null;
  initPromise = null;
}
