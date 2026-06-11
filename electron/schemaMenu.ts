import { BrowserWindow, type MenuItemConstructorOptions } from "electron";
import {
  SCHEMA_MENU_ENTRIES,
  SCHEMA_MENU_SECTIONS,
  type SchemaDownloadId,
} from "../shared/schemaMenuManifest";

function sendDownloadSchema(id: SchemaDownloadId): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.send("download-schema", id);
  }
}

export function buildNativeSchemaMenuItems(): MenuItemConstructorOptions[] {
  const entryById = new Map(SCHEMA_MENU_ENTRIES.map((entry) => [entry.id, entry]));
  const items: MenuItemConstructorOptions[] = [];

  for (const [index, section] of SCHEMA_MENU_SECTIONS.entries()) {
    if (index > 0) {
      items.push({ type: "separator" });
    }
    items.push({ label: section.label, enabled: false });
    for (const schemaId of section.schemaIds) {
      const entry = entryById.get(schemaId);
      if (!entry) {
        throw new Error(`Missing schema menu entry for: ${schemaId}`);
      }
      items.push({
        label: entry.label,
        click: () => sendDownloadSchema(entry.id),
      });
    }
  }

  return items;
}
