export const MUSELAB_FORMAT_VERSION = 5;

export const BUNDLE_SCHEMA_ID = "https://muselab.dev/schemas/bundle.schema.json";
export const STORY_SCHEMA_ID = "https://muselab.dev/schemas/story.schema.json";
export const PROMPTS_SCHEMA_ID = "https://muselab.dev/schemas/prompts.schema.json";
export const MLVN_SCHEMA_ID = "https://muselab.dev/schemas/mlvn.schema.json";

export const MLVN_METADATA_FILE = "muselab.json";

export interface ManifestMetadata {
  formatVersion?: number;
  schema?: string;
  $schema?: string;
}

export function readManifestMetadata(data: unknown): ManifestMetadata {
  if (!data || typeof data !== "object") {
    return {};
  }
  const record = data as Record<string, unknown>;
  return {
    formatVersion: typeof record.formatVersion === "number" ? record.formatVersion : undefined,
    schema: typeof record.schema === "string" ? record.schema : undefined,
    $schema: typeof record.$schema === "string" ? record.$schema : undefined,
  };
}

export function collectFormatVersionWarnings(
  metadata: ManifestMetadata,
  expectedSchema?: string
): string[] {
  const warnings: string[] = [];

  if (metadata.formatVersion === undefined) {
    warnings.push("Missing formatVersion; treating this as a legacy project file.");
  } else if (metadata.formatVersion > MUSELAB_FORMAT_VERSION) {
    warnings.push(
      `Format version ${metadata.formatVersion} is newer than this app supports (${MUSELAB_FORMAT_VERSION}).`
    );
  } else if (metadata.formatVersion < MUSELAB_FORMAT_VERSION) {
    warnings.push(
      `Format version ${metadata.formatVersion} is older than the current format (${MUSELAB_FORMAT_VERSION}).`
    );
  }

  const schemaRef = metadata.schema ?? metadata.$schema;
  if (expectedSchema && schemaRef && schemaRef !== expectedSchema) {
    warnings.push(`Unexpected schema reference: ${schemaRef}`);
  }

  return warnings;
}
