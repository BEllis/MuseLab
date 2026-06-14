import type { EditorView } from "@codemirror/view";
import { collapseAllTemplateFolds } from "./templateFoldCommands";

export function applyDefaultTemplateFolds(view: EditorView): void {
  collapseAllTemplateFolds(view);
}
