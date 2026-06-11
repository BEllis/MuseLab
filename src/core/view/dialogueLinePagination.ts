export function shouldResetDialogueLinePage(previousHtml: string, nextHtml: string): boolean {
  return nextHtml.length < previousHtml.length || !nextHtml.startsWith(previousHtml);
}

export function countLinesThatFit(
  lineOffsets: number[],
  contentHeight: number,
  startLine: number,
  viewportHeightPx: number,
): number {
  if (lineOffsets.length === 0) return 1;
  if (viewportHeightPx <= 0) return 1;

  const top = lineOffsets[startLine] ?? 0;
  let count = 0;

  for (let i = startLine; i < lineOffsets.length; i++) {
    const lineBottom = lineOffsets[i + 1] ?? contentHeight;
    if (count > 0 && lineBottom - top > viewportHeightPx) break;
    count++;
  }

  return Math.max(1, count);
}

export function getDialoguePageState(
  lineOffsets: number[],
  contentHeight: number,
  startLineIndex: number,
  viewportHeightPx: number,
): {
  visibleTop: number;
  linesOnPage: number;
  hasMoreToPaginate: boolean;
} {
  const linesOnPage = countLinesThatFit(
    lineOffsets,
    contentHeight,
    startLineIndex,
    viewportHeightPx,
  );
  const visibleTop = lineOffsets[startLineIndex] ?? 0;
  const nextStartLine = startLineIndex + linesOnPage;
  const hasMoreToPaginate = nextStartLine < lineOffsets.length;
  return { visibleTop, linesOnPage, hasMoreToPaginate };
}

export function clampDialogueStartLine(lineOffsets: number[], startLineIndex: number): number {
  if (lineOffsets.length === 0) return 0;
  return Math.min(startLineIndex, Math.max(0, lineOffsets.length - 1));
}

/** Start line of the last page that still fits in the viewport. */
export function getLastPageStartLine(
  lineOffsets: number[],
  contentHeight: number,
  viewportHeightPx: number,
  startLineIndex = 0,
): number {
  let pageStart = clampDialogueStartLine(lineOffsets, startLineIndex);
  while (true) {
    const { linesOnPage } = getDialoguePageState(
      lineOffsets,
      contentHeight,
      pageStart,
      viewportHeightPx,
    );
    const nextStart = pageStart + linesOnPage;
    if (nextStart >= lineOffsets.length) return pageStart;
    pageStart = nextStart;
  }
}

/** Measure Y offsets (px, relative to root top) for each visual line of rich text. */
export function measureVisualLineOffsets(root: HTMLElement): number[] {
  const rootTop = root.getBoundingClientRect().top;
  const offsets: number[] = [];
  let lastLineTop: number | null = null;

  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent?.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let textNode = walker.nextNode();
  while (textNode) {
    const text = textNode.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
      range.setStart(textNode, i);
      range.setEnd(textNode, Math.min(i + 1, text.length));
      for (const rect of range.getClientRects()) {
        if (rect.height === 0) continue;
        const lineTop = rect.top;
        if (lastLineTop === null || lineTop > lastLineTop + 1) {
          offsets.push(lineTop - rootTop);
          lastLineTop = lineTop;
        }
      }
    }
    textNode = walker.nextNode();
  }

  if (offsets.length === 0) offsets.push(0);
  return offsets;
}
