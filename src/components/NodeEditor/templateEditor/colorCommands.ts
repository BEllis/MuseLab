import type { EditorView } from "@codemirror/view";

export const FORMAT_COLOR_END = "@Format.ColorEnd()";

const COLOR_START_PATTERN = /@Format\.ColorStart\("([^"]*)"\)/g;
const COLOR_START_AT_END_PATTERN = /@Format\.ColorStart\("([^"]*)"\)$/;

export function formatColorStartSnippet(color: string): string {
  return `@Format.ColorStart("${color}")`;
}

export type ColorStartMatch = {
  from: number;
  to: number;
};

export function findColorStartForSelection(
  doc: string,
  selFrom: number,
  selTo: number
): ColorStartMatch | null {
  const matches: ColorStartMatch[] = [];
  const re = new RegExp(COLOR_START_PATTERN.source, "g");
  let match = re.exec(doc);
  while (match) {
    matches.push({ from: match.index, to: match.index + match[0].length });
    match = re.exec(doc);
  }

  for (const entry of matches) {
    const overlaps = selFrom < entry.to && selTo > entry.from;
    const cursorAfterTag = selFrom === selTo && selFrom === entry.to;
    if (overlaps || cursorAfterTag) {
      return entry;
    }
  }

  if (selFrom > 0) {
    const before = doc.slice(Math.max(0, selFrom - 80), selFrom);
    const tail = before.match(COLOR_START_AT_END_PATTERN);
    if (tail) {
      return {
        from: selFrom - tail[0].length,
        to: selFrom,
      };
    }
  }

  return null;
}

export function applyColorAtCursor(view: EditorView, color: string): string {
  const doc = view.state.doc.toString();
  const { from, to } = view.state.selection.main;
  const existing = findColorStartForSelection(doc, from, to);
  const snippet = formatColorStartSnippet(color);

  if (existing) {
    const delta = snippet.length - (existing.to - existing.from);
    view.dispatch({
      changes: { from: existing.from, to: existing.to, insert: snippet },
      selection: { anchor: from + (from >= existing.to ? delta : 0), head: to + (to >= existing.to ? delta : 0) },
    });
    return view.state.doc.toString();
  }

  if (from !== to) {
    const open = snippet;
    const selected = doc.slice(from, to);
    const insert = open + selected + FORMAT_COLOR_END;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    });
    return view.state.doc.toString();
  }

  view.dispatch({
    changes: { from, to, insert: snippet },
    selection: { anchor: from + snippet.length },
  });
  return view.state.doc.toString();
}
