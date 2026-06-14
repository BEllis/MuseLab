import { foldEffect, foldedRanges, unfoldEffect } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import {
  collectTemplateFoldRanges,
  type TemplateFoldRange,
} from "@/core/cito/parseTemplateSurface";

export function uniqueTemplateFoldSpans(ranges: TemplateFoldRange[]): Array<Pick<TemplateFoldRange, "from" | "to">> {
  const seen = new Set<string>();
  const unique: Array<Pick<TemplateFoldRange, "from" | "to">> = [];
  for (const range of ranges) {
    if (range.to - range.from < 4) continue;
    const key = `${range.from}:${range.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ from: range.from, to: range.to });
  }
  return unique;
}

export function collapseAllTemplateFolds(view: EditorView): boolean {
  const ranges = uniqueTemplateFoldSpans(collectTemplateFoldRanges(view.state.doc.toString()));
  if (ranges.length === 0) return false;

  view.dispatch({
    effects: ranges.map((range) => foldEffect.of(range)),
  });
  return true;
}

export function expandAllTemplateFolds(view: EditorView): boolean {
  const folded = foldedRanges(view.state);
  if (!folded.size) return false;

  const effects: ReturnType<typeof unfoldEffect.of>[] = [];
  folded.between(0, view.state.doc.length, (from, to) => {
    effects.push(unfoldEffect.of({ from, to }));
  });
  if (effects.length === 0) return false;

  view.dispatch({ effects });
  return true;
}
