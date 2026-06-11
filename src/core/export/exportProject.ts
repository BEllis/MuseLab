import type { ProjectBundle } from "../model/projectBundle";
import type { ExportTarget } from "../cito/exportTarget";
import { transpileCiToTarget } from "../cito/transpile";
import { generateMuseLabEngineCi } from "./generateMuseLabEngineCi";
import { packExportArchive } from "./packExportArchive";

export type ExportProjectOptions = {
  target: ExportTarget;
  namespace: string;
  defaultLocale: string;
};

export async function exportProject(
  bundle: ProjectBundle,
  options: ExportProjectOptions
): Promise<Uint8Array> {
  void options.namespace;
  const ciSource = generateMuseLabEngineCi({
    project: bundle.project,
    promptsByLocale: bundle.promptsByLocale,
  });
  const transpiledSource = await transpileCiToTarget(ciSource, options.target);
  return packExportArchive(bundle, ciSource, transpiledSource, options.target);
}
