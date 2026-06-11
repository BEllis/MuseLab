import { describe, expect, it } from "vitest";
import { expressionFoldLabel, shouldDefaultCollapseFold } from "./expressionLabel";

describe("expressionFoldLabel", () => {
  it("labels expression and if folds", () => {
    expect(
      expressionFoldLabel({
        from: 0,
        to: 10,
        kind: "expr",
        expr: 'rt.PlaySoundClip("sfx", 0, -1, -1)',
        isStatement: true,
      })
    ).toBe('▶ rt.PlaySoundClip');

    expect(
      expressionFoldLabel({
        from: 0,
        to: 20,
        kind: "if",
        condition: 'rt.GetBool("flag")',
        isStatement: false,
      })
    ).toBe('▶ if rt.GetBool("flag")');
  });
});

describe("shouldDefaultCollapseFold", () => {
  it("collapses statements and if blocks by default", () => {
    expect(
      shouldDefaultCollapseFold({
        from: 0,
        to: 1,
        kind: "expr",
        expr: "prompter.WaitInMs(500)",
        isStatement: true,
      })
    ).toBe(true);
    expect(
      shouldDefaultCollapseFold({
        from: 0,
        to: 1,
        kind: "expr",
        expr: "Format.BoldStart()",
        isStatement: false,
      })
    ).toBe(false);
  });
});
