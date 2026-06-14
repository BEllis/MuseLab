import {
  SCHEMA_MENU_ENTRIES,
  SCHEMA_MENU_SECTIONS,
} from "@muselab/shared/schemaMenuManifest";
import type { MenuItem } from "@/components/MenuBar/menuTypes";
import { downloadSchema } from "./downloadSchema";

export function buildHelpSchemaMenuItems(): MenuItem[] {
  const entryById = new Map(SCHEMA_MENU_ENTRIES.map((entry) => [entry.id, entry]));
  const items: MenuItem[] = [];

  for (const [index, section] of SCHEMA_MENU_SECTIONS.entries()) {
    if (index > 0) {
      items.push({ type: "separator" });
    }
    items.push({ type: "header", label: section.label });
    for (const schemaId of section.schemaIds) {
      const entry = entryById.get(schemaId);
      if (!entry) {
        throw new Error(`Missing schema menu entry for: ${schemaId}`);
      }
      items.push({
        label: entry.label,
        action: () => downloadSchema(entry.id),
      });
    }
  }

  return items;
}
