import type { UnpackedProjectArchive } from "./projectArchive";
import {
  summarizeValidationWarnings,
  validateBundlePayload,
  validateLocalePrompts,
  validateMlvnMetadata,
  validateStoryManifest,
  type ValidationResult,
} from "../model/schemaValidation";

function legacyArchiveMetadataWarning(): ValidationResult {
  return {
    valid: true,
    warnings: ["Missing muselab.json archive metadata; treating this as a legacy archive."],
    metadata: {},
  };
}

export function validateStoredProjectJson(raw: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return ["Project file is not valid JSON."];
  }

  if (data && typeof data === "object" && "promptsByLocale" in data) {
    return summarizeValidationWarnings("Project bundle", [validateBundlePayload(data)]);
  }

  return summarizeValidationWarnings("Project manifest", [validateStoryManifest(data)]);
}

export function validateUnpackedArchive(unpacked: UnpackedProjectArchive): string[] {
  const results: ValidationResult[] = [];

  if (unpacked.metadata) {
    results.push(validateMlvnMetadata(unpacked.metadata));
  } else {
    results.push(legacyArchiveMetadataWarning());
  }

  let manifestData: unknown;
  try {
    manifestData = JSON.parse(unpacked.manifest);
  } catch {
    return [
      ...summarizeValidationWarnings(".mlvn archive", results),
      "Project manifest is not valid JSON.",
    ];
  }
  results.push(validateStoryManifest(manifestData));

  for (const promptJson of unpacked.promptSources.values()) {
    let promptData: unknown;
    try {
      promptData = JSON.parse(promptJson);
    } catch {
      return [
        ...summarizeValidationWarnings(".mlvn archive", results),
        "Locale prompts file is not valid JSON.",
      ];
    }
    results.push(validateLocalePrompts(promptData));
  }

  return summarizeValidationWarnings(".mlvn archive", results);
}
