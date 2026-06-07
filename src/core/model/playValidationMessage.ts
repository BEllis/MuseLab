import type { PlayEntryValidation } from "./graphHierarchy";

export function getPlayValidationMessage(validation: Extract<PlayEntryValidation, { ok: false }>): string {
  switch (validation.reason) {
    case "no_nodes":
      return "Add at least one scene before playing.";
    case "no_entry":
      return "Every scene has an incoming link, so there is no starting scene. Leave one scene without incoming links to mark where the story begins.";
    case "multiple_entries":
      return "Multiple scenes have no incoming links, so the story has more than one possible start. Connect or remove links until only one starting scene remains.";
  }
}
