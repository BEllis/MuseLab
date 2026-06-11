import { codeFolding, foldService, unfoldEffect } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { collectTemplateFoldRanges } from "@/core/cito/parseTemplateSurface";
import { templateFoldAffordances } from "./templateFoldAffordances";

const COLLAPSED_FOLD_LABEL = "...";

type TemplateFoldPlaceholder = {
  from: number;
  to: number;
};

function prepareTemplateFoldPlaceholder(
  _state: EditorState,
  { from, to }: { from: number; to: number }
): TemplateFoldPlaceholder {
  return { from, to };
}

function templateFoldPlaceholderDOM(
  view: EditorView,
  _onclick: (event: Event) => void,
  prepared: TemplateFoldPlaceholder | null
): HTMLElement {
  const element = document.createElement("span");
  element.className = "cm-foldPlaceholder";
  element.textContent = COLLAPSED_FOLD_LABEL;
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", "Expand expression");
  element.title = "Expand";
  element.onclick = (event) => {
    event.preventDefault();
    if (!prepared) return;
    view.dispatch({ effects: unfoldEffect.of({ from: prepared.from, to: prepared.to }) });
  };
  return element;
}

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
    placeholder: COLLAPSED_FOLD_LABEL,
  };
}

export function templateFolding() {
  return [
    codeFolding({
      preparePlaceholder: prepareTemplateFoldPlaceholder,
      placeholderDOM: templateFoldPlaceholderDOM,
    }),
    foldService.of((state, from, to) => foldRangeAt(state, from) ?? foldRangeAt(state, to)),
    ...templateFoldAffordances(),
  ];
}
