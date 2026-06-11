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
  ".cm-template-error": {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderBottom: "2px wavy #ef4444",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--app-surface-hover)",
    color: "var(--app-text-muted)",
    border: "1px solid var(--app-border)",
    borderRadius: "4px",
    padding: "0 6px",
    fontFamily: "inherit",
    fontSize: "12px",
    cursor: "pointer",
  },
});
