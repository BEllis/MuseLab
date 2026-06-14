import { foldEffect, foldedRanges, unfoldEffect } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { collectTemplateFoldRanges } from "@/core/cito/parseTemplateSurface";
import { uniqueTemplateFoldSpans } from "./templateFoldCommands";

class FoldAffordanceWidget extends WidgetType {
  constructor(
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  eq(other: FoldAffordanceWidget): boolean {
    return this.from === other.from && this.to === other.to;
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement("span");
    button.className = "cm-template-fold-affordance";
    button.textContent = "▶";
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "Collapse expression");
    button.onmousedown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ effects: foldEffect.of({ from: this.from, to: this.to }) });
    };
    return button;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function isRangeFolded(folded: DecorationSet, from: number, to: number): boolean {
  let found = false;
  folded.between(from, from, (foldFrom, foldTo) => {
    if (foldFrom === from && foldTo === to) found = true;
  });
  return found;
}

function buildFoldAffordanceDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const ranges = uniqueTemplateFoldSpans(collectTemplateFoldRanges(state.doc.toString()));
  const folded = foldedRanges(state);
  const decorations: Range<Decoration>[] = [];

  for (const range of ranges) {
    if (isRangeFolded(folded, range.from, range.to)) continue;
    decorations.push(
      Decoration.widget({
        widget: new FoldAffordanceWidget(range.from, range.to),
        side: -1,
      }).range(range.from)
    );
  }

  return Decoration.set(decorations, true);
}

function foldStateChanged(update: ViewUpdate): boolean {
  return update.transactions.some((transaction) =>
    transaction.effects.some((effect) => effect.is(foldEffect) || effect.is(unfoldEffect))
  );
}

const templateFoldAffordancePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFoldAffordanceDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || foldStateChanged(update)) {
        this.decorations = buildFoldAffordanceDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  }
);

const templateFoldAffordanceTheme = EditorView.baseTheme({
  ".cm-template-fold-affordance": {
    color: "var(--app-text-muted)",
    cursor: "pointer",
    userSelect: "none",
    marginRight: "1px",
  },
});

export function templateFoldAffordances(): Extension[] {
  return [templateFoldAffordanceTheme, templateFoldAffordancePlugin];
}
