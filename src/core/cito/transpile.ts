import { createFormatRuntime, type FormatRuntime } from "./formatRuntime";
import type { MuseLabRuntimeBridge } from "./runtimeBridge";

export type TranspileCitoRequest = {
  ciSource: string;
};

export type TranspileCitoResult = {
  js: string;
};

const jsCache = new Map<string, string>();

function cacheKey(ciSource: string): string {
  let hash = 0;
  for (let i = 0; i < ciSource.length; i++) {
    hash = (hash * 31 + ciSource.charCodeAt(i)) | 0;
  }
  return `cito:${hash}:${ciSource.length}`;
}

export function getTranspileCitoUnavailableMessage(): string {
  return "Cito transpilation requires the MuseLab desktop app (Electron). Run npm run electron:dev.";
}

export async function transpileCiToJs(ciSource: string): Promise<string> {
  const key = cacheKey(ciSource);
  const cached = jsCache.get(key);
  if (cached) return cached;

  const api = window.electronAPI?.transpileCito;
  if (!api) {
    throw new Error(getTranspileCitoUnavailableMessage());
  }

  const result = await api({ ciSource });
  jsCache.set(key, result.js);
  return result.js;
}

export function runTranspiledMethod(
  js: string,
  className: string,
  methodName: "render" | "eval",
  rt: MuseLabRuntimeBridge,
  format: FormatRuntime = createFormatRuntime()
): unknown {
  const fn = new Function(
    "rt",
    "__format",
    `
    ${js}
    if (typeof Format !== "undefined") {
      for (const key of Object.keys(__format)) {
        Format[key] = __format[key];
      }
    }
    const target = ${className};
    if (!target || typeof target.${methodName} !== "function") {
      throw new Error("Missing transpiled method ${className}.${methodName}");
    }
    return target.${methodName}(rt);
  `
  ) as (rt: MuseLabRuntimeBridge, format: FormatRuntime) => unknown;

  return fn(rt, format);
}

export function clearTranspileCache(): void {
  jsCache.clear();
}
