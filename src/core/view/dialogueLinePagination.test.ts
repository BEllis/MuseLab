import { describe, expect, it } from "vitest";
import {
  clampDialogueStartLine,
  countLinesThatFit,
  getDialoguePageState,
  getLastPageStartLine,
  shouldResetDialogueLinePage,
} from "./dialogueLinePagination";

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
      visibleTop: 0,
      linesOnPage: 3,
      hasMoreToPaginate: true,
    });
  });

  it("shows a later page", () => {
    expect(getDialoguePageState(lineOffsets, contentHeight, 3, viewportHeight)).toEqual({
      visibleTop: 60,
      linesOnPage: 3,
      hasMoreToPaginate: false,
    });
  });

  it("handles empty offsets", () => {
    expect(getDialoguePageState([0], 0, 0, 60)).toEqual({
      visibleTop: 0,
      linesOnPage: 1,
      hasMoreToPaginate: false,
    });
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
});

describe("clampDialogueStartLine", () => {
  it("clamps past the final line", () => {
    expect(clampDialogueStartLine([0, 20, 40], 5)).toBe(2);
  });

  it("keeps valid start lines", () => {
    expect(clampDialogueStartLine([0, 20, 40], 1)).toBe(1);
  });
});
