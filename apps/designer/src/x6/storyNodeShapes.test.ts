import { describe, expect, it } from "vitest";
import { ARROW_PATH_REF_D, arrowNodeSizeForLabel } from "./storyNodeShapes";

describe("storyNodeShapes", () => {
  it("uses a closed block-arrow path with a right-pointing tip", () => {
    expect(ARROW_PATH_REF_D).toMatch(/^M /);
    expect(ARROW_PATH_REF_D).toMatch(/ Z$/);
    expect(ARROW_PATH_REF_D).toContain("L 100 26");
  });

  it("grows arrow nodes for longer labels", () => {
    expect(arrowNodeSizeForLabel("Start")).toEqual({ width: 104, height: 52 });
    const longLabel = "Jump To Chapter Two Opening";
    expect(arrowNodeSizeForLabel(longLabel).width).toBeGreaterThan(104);
    expect(arrowNodeSizeForLabel(longLabel).height).toBe(52);
  });
});
