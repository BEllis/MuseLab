import type { PlayEntryValidation } from "./graphHierarchy";

export function getPlayValidationMessage(
  validation: Extract<PlayEntryValidation, { ok: false }>
): string {
  switch (validation.reason) {
    case "no_nodes":
      return "Add at least one node before playing.";
    case "no_starts":
      return "Add at least one Start node to mark where the story can begin.";
    case "no_entry_configured":
      return 'Choose a Start node in "Start at" before playing.';
    case "invalid_entry":
      return 'The configured "Start at" node is missing or is not a Start node. Choose a valid Start node.';
    case "duplicate_names":
      return `Node names must be unique. Duplicates: ${validation.duplicateNames?.join(", ") ?? "unknown"}.`;
  }
}
