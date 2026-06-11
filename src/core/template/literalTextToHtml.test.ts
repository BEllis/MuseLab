import { describe, expect, it } from "vitest";
import { literalTextToHtml } from "./literalTextToHtml";

describe("literalTextToHtml", () => {
  it("keeps single spaces wrappable", () => {
    expect(literalTextToHtml("Something really long")).toBe("Something really long");
  });

  it("preserves multiple spaces as nbsp", () => {
    expect(literalTextToHtml("a  b")).toBe("a&nbsp;&nbsp;b");
  });

  it("converts newlines to br", () => {
    expect(literalTextToHtml("line one\nline two")).toBe("line one<br>line two");
  });
});
