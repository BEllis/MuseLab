import type { EditorView } from "@codemirror/view";

export function getEditorText(view: EditorView): string {
  return view.state.doc.toString();
}

export function insertAtCursor(view: EditorView, text: string): string {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  return view.state.doc.toString();
}

export function insertAroundSelection(view: EditorView, open: string, close: string): string {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);
  const insert = open + selected + close;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
  return view.state.doc.toString();
}
