import { describe, expect, it } from "vitest";
import {
  collectRazorCodeRanges,
  collectTemplateFoldRanges,
  isInsideTemplateExpression,
  isStatementExpression,
  parseTemplateSurface,
  RazorTemplateParseError,
} from "./parseTemplateSurface";

describe("parseTemplateSurface", () => {
  it("parses literals and output expressions", () => {
    expect(parseTemplateSurface('Hi @rt.GetString("name")!')).toEqual([
      { kind: "literal", value: "Hi " },
      { kind: "expr", value: 'rt.GetString("name")', isStatement: false, isOutput: true },
      { kind: "literal", value: "!" },
    ]);
  });

  it("parses parenthesized output expressions", () => {
    expect(parseTemplateSurface('Score: @(rt.GetInt("score"))')).toEqual([
      { kind: "literal", value: "Score: " },
      { kind: "expr", value: 'rt.GetInt("score")', isStatement: false, isOutput: true },
    ]);
  });

  it("parses format output via bare @", () => {
    expect(parseTemplateSurface("@Format.BoldStart()hi@Format.BoldEnd()")).toEqual([
      { kind: "expr", value: "Format.BoldStart()", isStatement: false, isOutput: true },
      { kind: "literal", value: "hi" },
      { kind: "expr", value: "Format.BoldEnd()", isStatement: false, isOutput: true },
    ]);
  });

  it("parses statement code blocks", () => {
    expect(parseTemplateSurface("@{ prompter.WaitInMs(500); }")).toEqual([
      { kind: "expr", value: "prompter.WaitInMs(500)", isStatement: true, isOutput: false },
    ]);
    expect(isStatementExpression("rt.PlaySoundClip(\"sfx\", 0, -1, -1)")).toBe(true);
    expect(isStatementExpression("rt.WaitForContinue()")).toBe(true);
    expect(isStatementExpression("Format.BoldStart()")).toBe(false);
  });

  it("parses if blocks", () => {
    expect(parseTemplateSurface('@if (rt.GetBool("x")) { Yes }')).toEqual([
      {
        kind: "if",
        condition: 'rt.GetBool("x")',
        body: [{ kind: "literal", value: " Yes " }],
      },
    ]);
  });

  it("preserves newlines verbatim in literals", () => {
    expect(parseTemplateSurface('Hello\n@rt.GetString("name")\nWorld')).toEqual([
      { kind: "literal", value: "Hello\n" },
      { kind: "expr", value: 'rt.GetString("name")', isStatement: false, isOutput: true },
      { kind: "literal", value: "\nWorld" },
    ]);
    expect(parseTemplateSurface('A\n\n@{ prompter.WaitInMs(500); }\n\nB')).toEqual([
      { kind: "literal", value: "A\n\n" },
      { kind: "expr", value: "prompter.WaitInMs(500)", isStatement: true, isOutput: false },
      { kind: "literal", value: "\n\nB" },
    ]);
  });

  it("parses escaped at signs", () => {
    expect(parseTemplateSurface("Email @@company.com")).toEqual([
      { kind: "literal", value: "Email " },
      { kind: "literal", value: "@" },
      { kind: "literal", value: "company.com" },
    ]);
  });

  it("rejects side-effect expressions in bare @ output", () => {
    expect(() => parseTemplateSurface("@prompter.WaitInMs(500)")).toThrow(RazorTemplateParseError);
  });
});

describe("collectRazorCodeRanges", () => {
  it("returns each Razor code span without literal text between tags", () => {
    const template = 'Hi @Format.BoldStart() there @if (rt.GetBool("x")) { Yes }';
    const ranges = collectRazorCodeRanges(template);
    expect([...ranges].sort((a, b) => a.from - b.from)).toEqual([
      { from: 3, to: 22 },
      { from: 29, to: 58 },
    ]);
    expect(isInsideTemplateExpression(10, ranges)).toBe(true);
    expect(isInsideTemplateExpression(0, ranges)).toBe(false);
    expect(isInsideTemplateExpression(25, ranges)).toBe(false);
  });
});

describe("collectTemplateFoldRanges", () => {
  it("returns source ranges for expressions and if blocks", () => {
    const template = 'A @rt.GetString("n") @if (rt.GetBool("f")) { B }';
    const ranges = collectTemplateFoldRanges(template);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toMatchObject({
      kind: "expr",
      expr: 'rt.GetString("n")',
      from: 2,
      to: 20,
    });
    expect(ranges[1]).toMatchObject({
      kind: "if",
      condition: 'rt.GetBool("f")',
    });
  });
});
