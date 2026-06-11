import { foldEffect } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import { collectTemplateFoldRanges } from "@/core/cito/parseTemplateSurface";
import { shouldDefaultCollapseFold } from "./expressionLabel";

export function applyDefaultTemplateFolds(view: EditorView): void {
  const ranges = collectTemplateFoldRanges(view.state.doc.toString()).filter(shouldDefaultCollapseFold);
  if (ranges.length === 0) return;

  view.dispatch({
    effects: ranges.map((range) => foldEffect.of({ from: range.from, to: range.to })),
  });
}
