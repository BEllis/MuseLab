import { describe, expect, it } from "vitest";
import {
  appendInlineDialogueMoreHint,
  clampDialogueStartLine,
  countLinesThatFit,
  getDialoguePageState,
  getLastPageStartLine,
  shouldPauseRevealPlayback,
  shouldResetDialogueLinePage,
} from "./dialogueLinePagination";

describe("appendInlineDialogueMoreHint", () => {
  it("appends the hint inside a trailing block tag", () => {
    expect(appendInlineDialogueMoreHint("<p>Hello world</p>")).toBe(
      '<p>Hello world <span class="muselab-dialogue-more-hint">...</span></p>',
    );
  });

  it("appends the hint after inline content", () => {
    expect(appendInlineDialogueMoreHint("Hello")).toBe(
      'Hello <span class="muselab-dialogue-more-hint">...</span>',
    );
  });

  it("leaves empty html unchanged", () => {
    expect(appendInlineDialogueMoreHint("   ")).toBe("   ");
  });
});

describe("shouldResetDialogueLinePage", () => {
  it("resets when content is replaced", () => {
    expect(shouldResetDialogueLinePage("<p>Hello</p>", "<p>Goodbye</p>")).toBe(true);
  });

  it("does not reset when content grows in place", () => {
    expect(shouldResetDialogueLinePage("<p>Hel", "<p>Hello</p>")).toBe(false);
  });

  it("resets when content shrinks", () => {
    expect(shouldResetDialogueLinePage("<p>Hello</p>", "<p>Hi</p>")).toBe(true);
  });
});

describe("countLinesThatFit", () => {
  const lineOffsets = [0, 20, 40, 60, 80, 100];

  it("fits as many uniform lines as the viewport allows", () => {
    expect(countLinesThatFit(lineOffsets, 120, 0, 60)).toBe(3);
    expect(countLinesThatFit(lineOffsets, 120, 0, 100)).toBe(5);
  });

  it("fits remaining lines on the final page", () => {
    expect(countLinesThatFit(lineOffsets, 120, 3, 60)).toBe(3);
  });

  it("always shows at least one line", () => {
    expect(countLinesThatFit(lineOffsets, 120, 0, 0)).toBe(1);
    expect(countLinesThatFit([], 0, 0, 60)).toBe(1);
  });
});

describe("getDialoguePageState", () => {
  const lineOffsets = [0, 20, 40, 60, 80, 100];
  const contentHeight = 120;
  const viewportHeight = 60;

  it("shows the first page", () => {
    expect(getDialoguePageState(lineOffsets, contentHeight, 0, viewportHeight)).toEqual({
      linesOnPage: 3,
      hasMoreToPaginate: true,
    });
  });

  it("shows a later page", () => {
    expect(getDialoguePageState(lineOffsets, contentHeight, 3, viewportHeight)).toEqual({
      linesOnPage: 3,
      hasMoreToPaginate: false,
    });
  });

  it("handles empty offsets", () => {
    expect(getDialoguePageState([0], 0, 0, 60)).toEqual({
      linesOnPage: 1,
      hasMoreToPaginate: false,
    });
  });
});

describe("shouldPauseRevealPlayback", () => {
  const lineOffsets = [0, 20, 40, 60, 80, 100];
  const contentHeight = 120;
  const viewportHeight = 60;

  it("does not pause while all lines fit on the first page", () => {
    expect(shouldPauseRevealPlayback([0, 20, 40], 60, 60)).toBe(false);
  });

  it("pauses once content overflows the first page", () => {
    expect(shouldPauseRevealPlayback(lineOffsets, contentHeight, viewportHeight)).toBe(true);
    expect(shouldPauseRevealPlayback([0, 20, 40, 60, 80], 100, 60)).toBe(true);
  });
});

describe("getLastPageStartLine", () => {
  const lineOffsets = [0, 20, 40, 60, 80, 100];
  const contentHeight = 120;
  const viewportHeight = 60;

  it("returns the first page when everything fits", () => {
    expect(getLastPageStartLine([0, 20, 40], 60, 60)).toBe(0);
  });

  it("returns the last page start when content overflows", () => {
    expect(getLastPageStartLine(lineOffsets, contentHeight, viewportHeight, 0)).toBe(3);
    expect(getLastPageStartLine(lineOffsets, contentHeight, viewportHeight, 1)).toBe(4);
  });

  it("does not mark the tail page as having more to paginate", () => {
    const tailStart = getLastPageStartLine(lineOffsets, contentHeight, viewportHeight, 0);
    const { linesOnPage, hasMoreToPaginate } = getDialoguePageState(
      lineOffsets,
      contentHeight,
      tailStart,
      viewportHeight,
    );
    expect(tailStart + linesOnPage).toBe(lineOffsets.length);
    expect(hasMoreToPaginate).toBe(false);
  });
});

describe("clampDialogueStartLine", () => {
  it("clamps past the final line", () => {
    expect(clampDialogueStartLine([0, 20, 40], 5)).toBe(2);
  });

  it("keeps valid start lines", () => {
    expect(clampDialogueStartLine([0, 20, 40], 1)).toBe(1);
  });
});
