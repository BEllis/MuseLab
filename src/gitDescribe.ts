import { isElectron } from "@/utils/isElectron";

export interface VersionInfo {
  version: string;
  gitDescribe: string;
}

const VERSION_JSON = `${import.meta.env.BASE_URL}version.json`;

export function getCompileTimeGitDescribe(): string {
  return import.meta.env.VITE_GIT_DESCRIBE ?? "unknown";
}

export async function fetchRuntimeGitDescribe(): Promise<string> {
  const info = await fetchRuntimeVersionInfo();
  return info.gitDescribe;
}

export async function fetchRuntimeVersionInfo(): Promise<VersionInfo> {
  const response = await fetch(VERSION_JSON, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`version.json responded with ${response.status}`);
  }

  const data = (await response.json()) as Partial<VersionInfo>;
  if (typeof data.gitDescribe !== "string" || data.gitDescribe.length === 0) {
    throw new Error("version.json is missing gitDescribe");
  }

  return {
    version: typeof data.version === "string" ? data.version : "unknown",
    gitDescribe: data.gitDescribe,
  };
}

export async function resolveGitDescribe(): Promise<string> {
  if (isElectron()) {
    return getCompileTimeGitDescribe();
  }
  try {
    return await fetchRuntimeGitDescribe();
  } catch {
    return "unknown";
  }
}
