let projectArchiveBaseDir: string | null = null;

export function setProjectArchiveBaseDir(dir: string | null): void {
  projectArchiveBaseDir = dir;
}

export function getProjectArchiveBaseDir(): string | null {
  return projectArchiveBaseDir;
}
