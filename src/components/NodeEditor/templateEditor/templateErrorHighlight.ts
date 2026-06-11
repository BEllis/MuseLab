import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

export type TemplateErrorRange = {
  from: number;
  to: number;
  message?: string;
};

export const setTemplateErrorEffect = StateEffect.define<TemplateErrorRange | null>();

const templateErrorField = StateField.define<TemplateErrorRange | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setTemplateErrorEffect)) {
        return effect.value;
      }
    }
    if (tr.docChanged && value) {
      return null;
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) => {
      const error = state.field(field);
      if (!error || error.from >= error.to) {
        return Decoration.none;
      }
      const docLength = state.doc.length;
      const from = Math.max(0, Math.min(error.from, docLength));
      const to = Math.max(from, Math.min(error.to, docLength));
      if (from >= to) return Decoration.none;
      return Decoration.set([Decoration.mark({ class: "cm-template-error" }).range(from, to)]);
    }),
});

export function templateErrorHighlight() {
  return templateErrorField;
}

export function setTemplateError(view: EditorView, error: TemplateErrorRange | null): void {
  if (!error) {
    view.dispatch({ effects: setTemplateErrorEffect.of(null) });
    return;
  }
  const from = Math.max(0, Math.min(error.from, view.state.doc.length));
  const to = Math.max(from, Math.min(error.to, view.state.doc.length));
  view.dispatch({ effects: setTemplateErrorEffect.of({ ...error, from, to }) });
}
