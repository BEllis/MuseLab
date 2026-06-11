import { EditorView } from "@codemirror/view";

export const templateEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--app-input-bg)",
    color: "var(--app-text)",
    fontSize: "14px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-content": {
    padding: "8px 10px",
    caretColor: "var(--app-text)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--app-text)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--app-surface-hover) !important",
  },
  ".cm-gutters": {
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text-muted)",
    borderRight: "1px solid var(--app-border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--app-surface-hover)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--app-surface-hover)",
    color: "var(--app-text-muted)",
    border: "1px solid var(--app-border)",
    borderRadius: "4px",
    padding: "0 6px",
    fontFamily: "inherit",
    fontSize: "12px",
  },
});
