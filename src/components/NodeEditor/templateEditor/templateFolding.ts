import { codeFolding, foldGutter, foldService } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { collectTemplateFoldRanges } from "@/core/cito/parseTemplateSurface";
import { expressionFoldLabel } from "./expressionLabel";

function foldRangeAt(state: EditorState, pos: number) {
  const ranges = collectTemplateFoldRanges(state.doc.toString());
  let best: (typeof ranges)[number] | null = null;
  for (const range of ranges) {
    if (pos < range.from || pos > range.to) continue;
    if (!best || range.to - range.from < best.to - best.from) {
      best = range;
    }
  }
  if (!best || best.to - best.from < 4) return null;
  return {
    from: best.from,
    to: best.to,
    placeholder: expressionFoldLabel(best),
  };
}

export function templateFolding() {
  return [
    codeFolding(),
    foldGutter(),
    foldService.of((state, from, to) => foldRangeAt(state, from) ?? foldRangeAt(state, to)),
  ];
}
