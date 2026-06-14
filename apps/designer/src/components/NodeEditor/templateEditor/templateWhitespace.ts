import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import {
  collectRazorCodeRanges,
  isInsideTemplateExpression,
} from "@/core/cito/parseTemplateSurface";

class SpaceIndicatorWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-template-space";
    span.textContent = "-";
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class SignificantNewlineWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-template-newline";
    span.textContent = "↵";
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function shouldShowNewlineIndicator(
  doc: string,
  newlinePos: number,
  templateRanges: ReturnType<typeof collectRazorCodeRanges>
): boolean {
  if (isInsideTemplateExpression(newlinePos, templateRanges)) return false;
  if (
    newlinePos > 0 &&
    doc[newlinePos - 1] === "\r" &&
    isInsideTemplateExpression(newlinePos - 1, templateRanges)
  ) {
    return false;
  }
  return true;
}

function buildLiteralWhitespaceDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc.toString();
  const templateRanges = collectRazorCodeRanges(doc);
  const decorations: Range<Decoration>[] = [];

  for (let index = 0; index < doc.length; index += 1) {
    if (doc[index] === " " && !isInsideTemplateExpression(index, templateRanges)) {
      decorations.push(
        Decoration.replace({
          widget: new SpaceIndicatorWidget(),
          inclusive: false,
        }).range(index, index + 1)
      );
    }
  }

  for (let lineNumber = 1; lineNumber < view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    const newlinePos = line.to;
    if (!shouldShowNewlineIndicator(doc, newlinePos, templateRanges)) continue;
    decorations.push(
      Decoration.widget({
        widget: new SignificantNewlineWidget(),
        side: 1,
      }).range(newlinePos)
    );
  }

  return Decoration.set(decorations, true);
}

const literalWhitespacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLiteralWhitespaceDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) {
        this.decorations = buildLiteralWhitespaceDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  }
);

export const templateWhitespaceTheme = EditorView.baseTheme({
  ".cm-template-space": {
    color: "var(--app-text-muted)",
    opacity: "0.65",
    pointerEvents: "none",
    userSelect: "none",
  },
  ".cm-template-newline": {
    color: "var(--app-text-muted)",
    opacity: "0.65",
    fontSize: "0.85em",
    pointerEvents: "none",
    userSelect: "none",
  },
});

export function templateWhitespace(): Extension[] {
  return [templateWhitespaceTheme, literalWhitespacePlugin];
}
