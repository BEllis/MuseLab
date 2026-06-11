export type SchemaMenuSection = {
  label: string;
  schemaIds: readonly SchemaDownloadId[];
};

export type SchemaDownloadId = "mlvn" | "story" | "prompts" | "bundle" | "script";

export type SchemaMenuEntry = {
  id: SchemaDownloadId;
  label: string;
  filename: string;
};

export const SCHEMA_MENU_ENTRIES: readonly SchemaMenuEntry[] = [
  { id: "mlvn", label: "MLVN Archive", filename: "muselab.mlvn.schema.json" },
  { id: "story", label: "Project Manifest", filename: "muselab.story.schema.json" },
  { id: "prompts", label: "Locale Prompts", filename: "muselab.prompts.schema.json" },
  { id: "bundle", label: "Legacy JSON Bundle", filename: "muselab.bundle.schema.json" },
  { id: "script", label: "Script (YAML & JSON)", filename: "muselab.script.schema.json" },
] as const;

export const SCHEMA_MENU_SECTIONS: readonly SchemaMenuSection[] = [
  {
    label: "Save / Load",
    schemaIds: ["mlvn", "story", "prompts", "bundle"],
  },
  {
    label: "Script Import / Export",
    schemaIds: ["script"],
  },
] as const;

export function getSchemaMenuEntry(id: SchemaDownloadId): SchemaMenuEntry {
  const entry = SCHEMA_MENU_ENTRIES.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Unknown schema id: ${id}`);
  }
  return entry;
}
