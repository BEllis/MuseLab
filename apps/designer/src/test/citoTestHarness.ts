import { spawn } from "child_process";
import { createServer, type Server } from "http";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { expect } from "vitest";
import {
  configureCitoWasmTestEnvironment,
  initCitoWasm,
  resetCitoWasmForTests,
} from "@/core/cito/citoWasmLoader";
import type { CitoTranspileTarget } from "@/core/cito/exportTarget";
import { clearTranspileCache } from "@/core/cito/transpile";

const OUTPUT_FILES: Record<CitoTranspileTarget, string> = {
  js: "output.js",
  cs: "MuseLabEngine.cs",
  py: "MuseLabEngine.py",
  java: "MuseLabEngine.java",
};

let wasmStaticServer: Server | null = null;
let wasmStaticServerBaseUrl: string | null = null;

function repoRoots(): string[] {
  const cwd = process.cwd();
  return [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "../..")];
}

export function resolveCitoCliExecutable(): { executable: string; dllPath?: string } | null {
  for (const root of repoRoots()) {
    const native = path.join(root, "tools", "cito", "cito");
    const dll = path.join(root, "tools", "cito", "cito.dll");
    if (existsSync(native)) {
      return { executable: native };
    }
    if (existsSync(dll)) {
      return { executable: "dotnet", dllPath: dll };
    }
  }
  return null;
}

export function isCitoCliAvailable(): boolean {
  return resolveCitoCliExecutable() != null;
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".wasm")) return "application/wasm";
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".dat")) return "application/octet-stream";
  if (filePath.endsWith(".blat")) return "application/octet-stream";
  return "application/octet-stream";
}

/** Serve apps/designer/public for cito-wasm integration tests. */
export async function startCitoWasmStaticServer(): Promise<string> {
  if (wasmStaticServerBaseUrl) {
    return wasmStaticServerBaseUrl;
  }

  const publicDir = path.resolve(process.cwd(), "public");
  const bootManifest = path.join(publicDir, "cito-wasm", "_framework", "blazor.boot.json");
  if (!existsSync(bootManifest)) {
    throw new Error("cito-wasm bundle missing; run pnpm --filter @muselab/designer run build:cito-wasm");
  }

  wasmStaticServer = createServer(async (req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0] ?? "/";
    const relativePath = decodeURIComponent(urlPath).replace(/^\/+/, "");
    const filePath = path.join(publicDir, relativePath);
    if (!filePath.startsWith(publicDir)) {
      res.statusCode = 403;
      res.end("forbidden");
      return;
    }

    try {
      const data = await readFile(filePath);
      res.setHeader("Content-Type", contentTypeFor(filePath));
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    wasmStaticServer!.once("error", reject);
    wasmStaticServer!.listen(0, "127.0.0.1", () => resolve());
  });

  const address = wasmStaticServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start cito-wasm static test server");
  }

  wasmStaticServerBaseUrl = `http://127.0.0.1:${address.port}/`;
  return wasmStaticServerBaseUrl;
}

export async function stopCitoWasmStaticServer(): Promise<void> {
  if (!wasmStaticServer) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    wasmStaticServer!.close((error) => (error ? reject(error) : resolve()));
  });
  wasmStaticServer = null;
  wasmStaticServerBaseUrl = null;
}

async function runCitoProcess(executable: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `cito exited with code ${code}`));
    });
  });
}

export async function transpileCiWithCli(
  ciSource: string,
  target: CitoTranspileTarget = "cs"
): Promise<string> {
  const resolved = resolveCitoCliExecutable();
  if (!resolved) {
    throw new Error("cito CLI not built");
  }

  const tmpDir = path.join(process.cwd(), "tmp", "cito-test");
  await mkdir(tmpDir, { recursive: true });
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ciPath = path.join(tmpDir, `input-${target}-${token}.ci`);
  const outputPath =
    target === "java"
      ? path.join(tmpDir, `java-${token}`, "MuseLabEngine.java")
      : path.join(tmpDir, `${token}-${OUTPUT_FILES[target]}`);
  await writeFile(ciPath, ciSource, "utf8");
  await mkdir(path.dirname(outputPath), { recursive: true });

  const args =
    resolved.executable === "dotnet"
      ? [resolved.dllPath!, "-l", target, "-o", outputPath, ciPath]
      : ["-l", target, "-o", outputPath, ciPath];

  await runCitoProcess(resolved.executable, args);
  return readFile(outputPath, "utf8");
}

export function assertRichEngineTranspileOutput(output: string, target: CitoTranspileTarget): void {
  expect(output).toMatch(/MuseLabEngine/i);
  if (target === "cs") {
    expect(output).toContain("EvaluateEdgeCondition");
    expect(output).toContain("GetJumpTargetStoryId");
    expect(output).toContain("RenderNodePrompt");
    return;
  }
  if (target === "py") {
    expect(output).toContain("_evaluate_edge_condition");
    expect(output).toContain("get_jump_target_story_id");
    expect(output).toContain("_render_node_prompt");
    return;
  }
  expect(output).toMatch(/evaluateEdgeCondition|EvaluateEdgeCondition/);
  expect(output).toMatch(/getJumpTargetStoryId|GetJumpTargetStoryId/);
}

export async function probeCitoWasm(): Promise<boolean> {
  if (typeof fetch !== "function") {
    return false;
  }

  try {
    const baseUrl = await startCitoWasmStaticServer();
    configureCitoWasmTestEnvironment(baseUrl);
    if (typeof window !== "undefined") {
      window.location.href = baseUrl;
    }
    const response = await fetch(new URL("cito-wasm/_framework/blazor.boot.json", baseUrl));
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureCitoWasmForTests(): Promise<boolean> {
  const available = await probeCitoWasm();
  if (!available) {
    return false;
  }

  resetCitoWasmForTests();
  configureCitoWasmTestEnvironment(wasmStaticServerBaseUrl!);
  if (typeof window !== "undefined") {
    window.location.href = wasmStaticServerBaseUrl!;
  }
  clearTranspileCache();
  await initCitoWasm();
  return true;
}

export async function installCliTranspileForTests(): Promise<boolean> {
  if (!isCitoCliAvailable()) {
    return false;
  }

  const { vi } = await import("vitest");
  const transpileModule = await import("@/core/cito/transpile");

  vi.spyOn(transpileModule, "transpileCiToTarget").mockImplementation(async (ciSource, target = "js") =>
    transpileCiWithCli(ciSource, target)
  );
  vi.spyOn(transpileModule, "transpileCiToJs").mockImplementation(async (ciSource) =>
    transpileCiWithCli(ciSource, "js")
  );
  clearTranspileCache();
  return true;
}
