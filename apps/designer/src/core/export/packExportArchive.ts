import { strToU8, unzipSync, zipSync } from "fflate";
import type { ProjectBundle } from "../model/projectBundle";
import { packProjectArchive } from "../project/projectArchive";
import {
  EXPORT_TARGET_LABELS,
  EXPORT_TARGET_OUTPUT_FILES,
  type ExportTarget,
} from "../cito/exportTarget";

function safeProjectName(name: string): string {
  return (name?.trim() || "muselab-project")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function generateReadme(bundle: ProjectBundle, target: ExportTarget): string {
  const outputFile = EXPORT_TARGET_OUTPUT_FILES[target];
  const language = EXPORT_TARGET_LABELS[target];
  return `# ${bundle.project.name} — MuseLab Export

This archive contains a ${language} export of your MuseLab visual novel project.

## Contents

- \`${outputFile}\` — transpiled MuseLab engine (${language})
- \`cito/MuseLabEngine.ci\` — Cito source used to generate the engine
- \`assets/\` — project media (backdrops, actors, sounds, fonts)
- \`prompts.<locale>.json\` — localized prompt text (reference copy)
- \`project.json\` — project manifest (reference copy)

## Getting started

1. Implement the module interfaces from the generated source (\`IMuseLabRuntime\`, \`IMuseLabFormat\`, \`IMuseLabPromptRenderer\`, and any custom modules).
2. Create a \`MuseLabEngine\` via \`MuseLabEngine.Create(...)\` with your implementations and a default locale tag.
3. Call \`Start()\`, \`StartStoryById(...)\`, \`StartStoryByIdAtNode(...)\`, \`StartStoryByPath(...)\`, or \`StartStoryByPathAtStartNode(...)\`.
4. Poll \`GetRuntimeState()\` and call \`GoToNode(targetNodeId)\` when the player selects a choice.

Asset files use archive-relative paths under \`assets/\`. Resolve media on disk using those paths next to the exported project root.
`;
}

export function exportArchiveFileName(projectName: string, target: ExportTarget): string {
  return `${safeProjectName(projectName)}-${target}-export.zip`;
}

export async function packExportArchive(
  bundle: ProjectBundle,
  ciSource: string,
  transpiledSource: string,
  target: ExportTarget
): Promise<Uint8Array> {
  const projectArchive = await packProjectArchive(bundle);
  const unpacked = unzipSync(projectArchive);
  const entries: Record<string, Uint8Array> = {};

  for (const [name, bytes] of Object.entries(unpacked)) {
    entries[name] = bytes;
  }

  entries["cito/MuseLabEngine.ci"] = strToU8(ciSource);
  entries[EXPORT_TARGET_OUTPUT_FILES[target]] = strToU8(transpiledSource);
  entries["README.md"] = strToU8(generateReadme(bundle, target));

  return zipSync(entries);
}
