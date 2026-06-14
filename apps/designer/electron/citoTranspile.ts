import { spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { app } from "electron";
import { tmpdir } from "os";

const memoryCache = new Map<string, string>();

export function resolveCitoToolPaths(): { executable: string; argsPrefix: string[] } {
  const dirs = app.isPackaged
    ? [path.join(process.resourcesPath, "cito")]
    : [
        path.join(app.getAppPath(), "tools", "cito"),
        path.join(app.getAppPath(), "..", "..", "tools", "cito"),
        path.join(process.cwd(), "tools", "cito"),
        path.join(process.cwd(), "..", "..", "tools", "cito"),
      ];

  for (const dir of dirs) {
    const standalone = path.join(dir, "cito");
    if (existsSync(standalone)) {
      return { executable: standalone, argsPrefix: [] };
    }
    const dll = path.join(dir, "cito.dll");
    if (existsSync(dll)) {
      const dotnet = resolveDotnetPath(dir);
      return { executable: dotnet, argsPrefix: [dll] };
    }
  }

  throw new Error(
    "cito not found. Run pnpm build:cito after installing the .NET 6 SDK."
  );
}

export function resolveDotnetPath(citoDir?: string): string {
  if (citoDir) {
    const bundled = path.join(citoDir, "dotnet");
    if (existsSync(bundled)) return bundled;
  }

  const dotnetRoot = process.env.DOTNET_ROOT;
  if (dotnetRoot) {
    const dotnet = path.join(dotnetRoot, "dotnet");
    if (existsSync(dotnet)) return dotnet;
  }

  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (home) {
    const homeDotnet = path.join(home, ".dotnet", "dotnet");
    if (existsSync(homeDotnet)) return homeDotnet;
  }

  return "dotnet";
}

export type CitoTranspileTarget = "js" | "cs" | "py" | "java";

const TARGET_OUTPUT: Record<CitoTranspileTarget, string> = {
  js: "output.js",
  cs: "output.cs",
  py: "output.py",
  java: "MuseLabEngine.java",
};

function cacheKey(target: CitoTranspileTarget, ciSource: string): string {
  return `${target}:${createHash("sha256").update(ciSource).digest("hex")}`;
}

export async function transpileCiToTarget(
  ciSource: string,
  target: CitoTranspileTarget = "js"
): Promise<string> {
  const key = cacheKey(target, ciSource);
  const cached = memoryCache.get(key);
  if (cached) return cached;

  const hash = createHash("sha256").update(ciSource).digest("hex");
  const tmpDir = path.join(tmpdir(), "muselab-cito", hash.slice(0, 16));
  await mkdir(tmpDir, { recursive: true });
  const ciPath = path.join(tmpDir, "input.ci");
  const outputPath = path.join(tmpDir, TARGET_OUTPUT[target]);

  await writeFile(ciPath, ciSource, "utf8");

  const { executable, argsPrefix } = resolveCitoToolPaths();

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(executable, [...argsPrefix, "-o", outputPath, ciPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
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

  const output = await readFile(outputPath, "utf8");
  memoryCache.set(key, output);
  return output;
}

export async function transpileCiToJs(ciSource: string): Promise<string> {
  return transpileCiToTarget(ciSource, "js");
}

export function clearCitoTranspileCache(): void {
  memoryCache.clear();
}
