import { isElectron } from "@/utils/isElectron";
import type { CitoTranspileTarget } from "./exportTarget";

export type CitoWasmLoadProgress = {
  phase: "config" | "runtime" | "assemblies" | "init";
  loaded: number;
  total: number;
  label: string;
};

type BootManifest = {
  resources?: {
    assembly?: Record<string, string>;
  };
};

type DotNetExports = {
  Foxoft: {
    Ci: {
      TranspileLib: {
        TranspileJs: (ciSource: string) => string;
        TranspileCs: (ciSource: string) => string;
        TranspilePy: (ciSource: string) => string;
        TranspileJava: (ciSource: string) => string;
      };
    };
  };
};

type DotNetRuntime = {
  getAssemblyExports: (assemblyName: string) => Promise<DotNetExports>;
};

type DotNetBuilder = {
  withConfigSrc: (src: string) => DotNetBuilder;
  withResourceLoader: (
    loader: (
      type: string,
      name: string,
      defaultUri: string,
      integrity: string,
      behavior: string
    ) => string | Promise<Response> | null | undefined
  ) => DotNetBuilder;
  create: () => Promise<DotNetRuntime>;
};

type DotNetModule = {
  dotnet: DotNetBuilder;
};

const CITO_ASSEMBLY = "cito-wasm";
const FRAMEWORK_DIR = "_framework/";

const WASM_TRANSPILERS: Record<
  CitoTranspileTarget,
  keyof DotNetExports["Foxoft"]["Ci"]["TranspileLib"]
> = {
  js: "TranspileJs",
  cs: "TranspileCs",
  py: "TranspilePy",
  java: "TranspileJava",
};

let transpileLib: DotNetExports["Foxoft"]["Ci"]["TranspileLib"] | null = null;
let initPromise: Promise<void> | null = null;
let testLocationHref: string | null = null;

/** Align WASM asset resolution with Vitest's dev-server origin. */
export function configureCitoWasmTestEnvironment(locationHref: string): void {
  testLocationHref = locationHref;
}

function wasmLocationHref(): string {
  if (testLocationHref) {
    return testLocationHref;
  }
  if (typeof window === "undefined") {
    throw new Error("window is unavailable");
  }
  return window.location.href;
}

function citoWasmBaseUrl(): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${base.endsWith("/") ? "" : "/"}cito-wasm/`;
}

function citoFrameworkBaseUrl(): string {
  return `${citoWasmBaseUrl()}${FRAMEWORK_DIR}`;
}

function citoFrameworkAbsoluteUrl(): string {
  return new URL(citoFrameworkBaseUrl(), wasmLocationHref()).href;
}

export function resolveWasmAssetUrl(
  base: string,
  assetUrl: string,
  locationHref: string = window.location.href
): string {
  if (/^https?:\/\//i.test(assetUrl) || assetUrl.startsWith("blob:")) {
    return assetUrl;
  }

  const normalized = assetUrl.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.startsWith("cito-wasm/")) {
    return new URL(normalized, locationHref).href;
  }

  return new URL(normalized, new URL(base, locationHref)).href;
}

function reportProgress(
  onProgress: ((progress: CitoWasmLoadProgress) => void) | undefined,
  progress: CitoWasmLoadProgress
): void {
  onProgress?.(progress);
}

async function loadBootManifest(frameworkUrl: string): Promise<BootManifest> {
  const bootUrl = new URL("blazor.boot.json", frameworkUrl).href;
  const response = await fetch(bootUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      "Cito WASM bundle not found. Run pnpm --filter @muselab/designer run build:cito-wasm before using the web app."
    );
  }
  return (await response.json()) as BootManifest;
}

async function importDotNetModule(frameworkUrl: string): Promise<DotNetModule> {
  const dotnetUrl = new URL("dotnet.js", frameworkUrl).href;
  return (await import(/* @vite-ignore */ dotnetUrl)) as DotNetModule;
}

export function isCitoWasmRequired(): boolean {
  return !isElectron();
}

export async function initCitoWasm(
  onProgress?: (progress: CitoWasmLoadProgress) => void
): Promise<void> {
  if (isElectron()) return;
  if (transpileLib) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const frameworkUrl = citoFrameworkAbsoluteUrl();

    reportProgress(onProgress, {
      phase: "config",
      loaded: 0,
      total: 1,
      label: "Loading transpiler configuration…",
    });

    const bootManifest = await loadBootManifest(frameworkUrl);
    const assemblyTotal = Object.keys(bootManifest.resources?.assembly ?? {}).length;

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

    const dotnetModule = await importDotNetModule(frameworkUrl);
    let downloadedAssemblies = 0;

    const runtime = await dotnetModule.dotnet
      .withConfigSrc(new URL("blazor.boot.json", frameworkUrl).href)
      .withResourceLoader((type, name, defaultUri) => {
        if (type !== "assembly") {
          return undefined;
        }

        const url = /^https?:\/\//i.test(defaultUri)
          ? defaultUri
          : resolveWasmAssetUrl(frameworkUrl, defaultUri);
        return fetch(url, { credentials: "same-origin" }).then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load Cito WASM asset: ${url} (${response.status})`);
          }
          if (name.endsWith(".wasm")) {
            downloadedAssemblies += 1;
            reportProgress(onProgress, {
              phase: "assemblies",
              loaded: Math.min(downloadedAssemblies, assemblyTotal),
              total: assemblyTotal,
              label: "Downloading Cito transpiler assemblies…",
            });
          }
          return response;
        });
      })
      .create();

    const exports = await runtime.getAssemblyExports(CITO_ASSEMBLY);
    const lib = exports.Foxoft.Ci.TranspileLib;
    if (typeof lib.TranspileJs !== "function") {
      throw new Error("Cito WASM transpiler export is missing.");
    }

    transpileLib = lib;

    reportProgress(onProgress, {
      phase: "init",
      loaded: 1,
      total: 1,
      label: "Ready",
    });
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}

export async function transpileCiSourceWithWasm(
  ciSource: string,
  target: CitoTranspileTarget = "js"
): Promise<string> {
  if (isElectron()) {
    throw new Error("transpileCiSourceWithWasm is only available on web.");
  }
  await initCitoWasm();
  if (!transpileLib) {
    throw new Error("Cito WASM transpiler is not initialized.");
  }
  const methodName = WASM_TRANSPILERS[target];
  const transpile = transpileLib[methodName];
  if (typeof transpile !== "function") {
    throw new Error(`Cito WASM transpiler for ${target} is missing. Rebuild with pnpm --filter @muselab/designer run build:cito-wasm.`);
  }
  return transpile.call(transpileLib, ciSource);
}

export function resetCitoWasmForTests(): void {
  transpileLib = null;
  initPromise = null;
  testLocationHref = null;
}
