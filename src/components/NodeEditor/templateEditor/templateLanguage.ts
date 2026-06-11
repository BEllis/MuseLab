import { EditorView } from "@codemirror/view";
import { museLabRazorLanguageSupport } from "./museLabRazorLanguage";

const razorLanguageSupport = museLabRazorLanguageSupport();

const templateHighlightStyles = EditorView.baseTheme({
  ".cm-template-literal": {
    color: "var(--app-text)",
  },
  ".cm-template-delimiter": {
    color: "var(--app-text-muted)",
    fontWeight: "600",
  },
  ".cm-template-control": {
    color: "var(--app-accent, #3b82f6)",
    fontWeight: "600",
  },
  ".cm-template-output": {
    color: "var(--app-accent, #3b82f6)",
  },
  ".cm-template-statement": {
    color: "var(--app-accent, #3b82f6)",
    fontStyle: "italic",
  },
  ".cm-template-module": {
    color: "var(--app-accent, #3b82f6)",
  },
  ".cm-template-method": {
    color: "var(--app-text)",
    fontWeight: "600",
  },
  ".cm-template-string": {
    color: "#16a34a",
  },
  ".cm-template-html": {
    color: "var(--app-text-muted)",
  },
});

export function templateSyntaxHighlighting() {
  return [razorLanguageSupport, templateHighlightStyles];
}
