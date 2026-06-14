import type { MuseLabRuntimeBridge } from "./runtimeBridge";
import { isElectron } from "@/utils/isElectron";
import { initCitoWasm, transpileCiSourceWithWasm } from "./citoWasmLoader";
import type { CitoTranspileTarget } from "./exportTarget";

export type TranspileCitoRequest = {
  ciSource: string;
  target?: CitoTranspileTarget;
};

export type TranspileCitoResult = {
  output: string;
  /** @deprecated Use output */
  js?: string;
};

const transpileCache = new Map<string, string>();

function cacheKey(target: CitoTranspileTarget, ciSource: string): string {
  let hash = 0;
  for (let i = 0; i < ciSource.length; i++) {
    hash = (hash * 31 + ciSource.charCodeAt(i)) | 0;
  }
  return `${target}:${hash}:${ciSource.length}`;
}

export function getTranspileCitoUnavailableMessage(): string {
  if (isElectron()) {
    return "Cito transpilation failed. Ensure cito is built (pnpm build:cito) and the desktop app is up to date.";
  }
  return "Cito transpilation is unavailable. Run pnpm --filter @muselab/designer run build:cito-wasm and reload the page.";
}

export async function transpileCiToTarget(
  ciSource: string,
  target: CitoTranspileTarget = "js"
): Promise<string> {
  const key = cacheKey(target, ciSource);
  const cached = transpileCache.get(key);
  if (cached) return cached;

  let output: string;
  if (isElectron()) {
    const api = window.electronAPI?.transpileCito;
    if (!api) {
      throw new Error(getTranspileCitoUnavailableMessage());
    }
    const result = await api({ ciSource, target });
    output = result.output ?? result.js ?? "";
    if (!output) {
      throw new Error("Cito transpilation returned empty output.");
    }
  } else {
    await initCitoWasm();
    output = await transpileCiSourceWithWasm(ciSource, target);
  }

  transpileCache.set(key, output);
  return output;
}

export async function transpileCiToJs(ciSource: string): Promise<string> {
  return transpileCiToTarget(ciSource, "js");
}

export function runTranspiledMethod(
  js: string,
  className: string,
  methodName: "render" | "eval",
  bindings: Record<string, unknown>,
  paramNames: string[]
): unknown {
  const bindingValues = paramNames.map((name) => bindings[name]);

  const fn = new Function(
    ...paramNames,
    `
    ${js}
    const target = ${className};
    if (!target || typeof target.${methodName} !== "function") {
      throw new Error("Missing transpiled method ${className}.${methodName}");
    }
    return target.${methodName}(${paramNames.join(", ")});
  `
  ) as (...args: unknown[]) => unknown;

  return fn(...bindingValues);
}

/** @deprecated Use bindings record overload */
export function runTranspiledMethodLegacy(
  js: string,
  className: string,
  methodName: "render" | "eval",
  rt: MuseLabRuntimeBridge
): unknown {
  return runTranspiledMethod(js, className, methodName, { rt }, ["rt"]);
}

export function clearTranspileCache(): void {
  transpileCache.clear();
}
