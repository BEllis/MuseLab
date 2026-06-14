import bundleSchema from "../../../muselab.bundle.schema.json";
import mlvnSchema from "../../../muselab.mlvn.schema.json";
import promptsSchema from "../../../muselab.prompts.schema.json";
import scriptSchema from "../../../muselab.script.schema.json";
import storySchema from "../../../muselab.story.schema.json";
import {
  getSchemaMenuEntry,
  type SchemaDownloadId,
} from "@muselab/shared/schemaMenuManifest";

const SCHEMA_DATA: Record<SchemaDownloadId, unknown> = {
  mlvn: mlvnSchema,
  story: storySchema,
  prompts: promptsSchema,
  bundle: bundleSchema,
  script: scriptSchema,
};

function downloadJsonFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadSchema(id: SchemaDownloadId): void {
  const entry = getSchemaMenuEntry(id);
  const data = SCHEMA_DATA[id];
  if (!data) {
    throw new Error(`Schema data is unavailable for: ${id}`);
  }
  downloadJsonFile(entry.filename, `${JSON.stringify(data, null, 2)}\n`);
}
