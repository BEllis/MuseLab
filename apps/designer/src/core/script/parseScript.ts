import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { validateScriptDocument } from "../model/schemaValidation";
import { MUSELAB_SCRIPT_FORMAT_VERSION } from "../model/formatVersion";
import type { MuseLabScriptDocument, MuseLabScriptOption } from "./types";

function normalizeOptionAliases(document: MuseLabScriptDocument): MuseLabScriptDocument {
  const normalizeOptions = (options: MuseLabScriptOption[] | undefined) => {
    for (const option of options ?? []) {
      if (!option.condition && option.on_click) {
        option.condition = option.on_click;
      }
    }
  };

  const clone = JSON.parse(JSON.stringify(document)) as MuseLabScriptDocument;
  if ("scenes" in clone && Array.isArray(clone.scenes)) {
    for (const scene of clone.scenes) {
      normalizeOptions(scene.options);
    }
  }
  if ("stories" in clone && Array.isArray(clone.stories)) {
    for (const story of clone.stories) {
      for (const scene of story.scenes) {
        normalizeOptions(scene.options);
      }
    }
  }
  return clone;
}

export function parseScriptText(text: string, fileName?: string): MuseLabScriptDocument {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Script file is empty");
  }

  const lowerName = fileName?.toLowerCase() ?? "";
  const useYaml =
    lowerName.endsWith(".yaml") ||
    lowerName.endsWith(".yml") ||
    lowerName.endsWith(".mls.yaml") ||
    (!lowerName.endsWith(".json") && !trimmed.startsWith("{") && !trimmed.startsWith("["));

  let parsed: unknown;
  try {
    parsed = useYaml ? parseYaml(trimmed) : JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `Failed to parse script${fileName ? ` (${fileName})` : ""}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const normalized = normalizeOptionAliases(parsed as MuseLabScriptDocument);
  const validation = validateScriptDocument(normalized);
  if (!validation.valid) {
    throw new Error(
      `Script validation failed:\n${validation.warnings.map((warning) => `- ${warning}`).join("\n")}`
    );
  }

  if (
    typeof (normalized as { format_version?: unknown }).format_version === "number" &&
    (normalized as { format_version: number }).format_version > MUSELAB_SCRIPT_FORMAT_VERSION
  ) {
    throw new Error(
      `Script format version ${(normalized as { format_version: number }).format_version} is newer than supported (${MUSELAB_SCRIPT_FORMAT_VERSION})`
    );
  }

  return normalized;
}

export function serializeScriptYaml(document: MuseLabScriptDocument): string {
  return stringifyYaml(document, { lineWidth: 0 });
}

export function serializeScriptJson(document: MuseLabScriptDocument): string {
  return JSON.stringify(document, null, 2);
}

export function scriptFileName(projectOrStoryName: string, format: "yaml" | "json"): string {
  const safe = projectOrStoryName.trim().replace(/[^\w.-]+/g, "_") || "script";
  return format === "yaml" ? `${safe}.mls.yaml` : `${safe}.mls.json`;
}
