import { describe, expect, it } from "vitest";
import {
  collectRazorCodeRanges,
  collectTemplateFoldRanges,
  isInsideTemplateExpression,
  isStatementExpression,
  parseTemplateSurface,
  RazorTemplateParseError,
  validateRazorTemplate,
} from "./parseTemplateSurface";

describe("parseTemplateSurface", () => {
  it("parses literals and output expressions", () => {
    const segments = parseTemplateSurface('Hi @rt.GetString("name")!');
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ kind: "literal", value: "Hi " });
    expect(segments[1]).toMatchObject({
      kind: "expr",
      value: 'rt.GetString("name")',
      isStatement: false,
      isOutput: true,
      from: 3,
      to: 24,
    });
    expect(segments[2]).toEqual({ kind: "literal", value: "!" });
  });

  it("parses parenthesized output expressions", () => {
    const segments = parseTemplateSurface('Score: @(rt.GetInt("score"))');
    expect(segments[1]).toMatchObject({
      kind: "expr",
      value: 'rt.GetInt("score")',
      isStatement: false,
      isOutput: true,
      from: 7,
      to: 28,
    });
  });

  it("parses format output via bare @", () => {
    const segments = parseTemplateSurface("@Format.BoldStart()hi@Format.BoldEnd()");
    expect(segments[0]).toMatchObject({
      kind: "expr",
      value: "Format.BoldStart()",
      isStatement: false,
      isOutput: true,
      from: 0,
      to: 19,
    });
    expect(segments[1]).toEqual({ kind: "literal", value: "hi" });
    expect(segments[2]).toMatchObject({
      kind: "expr",
      value: "Format.BoldEnd()",
      isStatement: false,
      isOutput: true,
      from: 21,
      to: 38,
    });
  });

  it("parses statement code blocks", () => {
    const segments = parseTemplateSurface("@{ prompter.WaitInMs(500); }");
    expect(segments[0]).toMatchObject({
      kind: "expr",
      value: "prompter.WaitInMs(500)",
      isStatement: true,
      isOutput: false,
      from: 0,
      to: 28,
    });
    expect(isStatementExpression("rt.PlaySoundClip(\"sfx\", 0, -1, -1)")).toBe(true);
    expect(isStatementExpression("prompter.WaitForContinue()")).toBe(true);
    expect(isStatementExpression('prompter.UpdateSpeaker("Maya")')).toBe(true);
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
    const segments = parseTemplateSurface('Hello\n@rt.GetString("name")\nWorld');
    expect(segments[0]).toEqual({ kind: "literal", value: "Hello\n" });
    expect(segments[1]).toMatchObject({
      kind: "expr",
      value: 'rt.GetString("name")',
      isStatement: false,
      isOutput: true,
    });
    expect(segments[2]).toEqual({ kind: "literal", value: "\nWorld" });

    const blockSegments = parseTemplateSurface('A\n\n@{ prompter.WaitInMs(500); }\n\nB');
    expect(blockSegments[0]).toEqual({ kind: "literal", value: "A\n\n" });
    expect(blockSegments[1]).toMatchObject({
      kind: "expr",
      value: "prompter.WaitInMs(500)",
      isStatement: true,
      isOutput: false,
    });
    expect(blockSegments[2]).toEqual({ kind: "literal", value: "\n\nB" });
  });

  it("parses escaped at signs", () => {
    expect(parseTemplateSurface("Email @@company.com")).toEqual([
      { kind: "literal", value: "Email " },
      { kind: "literal", value: "@" },
      { kind: "literal", value: "company.com" },
    ]);
  });

  it("rejects side-effect expressions in bare @ output", () => {
    try {
      parseTemplateSurface("@prompter.WaitInMs(500)");
      expect.fail("expected parse error");
    } catch (error) {
      expect(error).toBeInstanceOf(RazorTemplateParseError);
      expect((error as RazorTemplateParseError).from).toBe(0);
      expect((error as RazorTemplateParseError).to).toBe(23);
    }
  });

  it("rejects mistaken @ in plain text when validated", () => {
    try {
      validateRazorTemplate("user@host.com");
      expect.fail("expected validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(RazorTemplateParseError);
      expect((error as RazorTemplateParseError).from).toBe(4);
      expect((error as RazorTemplateParseError).to).toBe(13);
      expect((error as RazorTemplateParseError).message).toMatch(/@@/);
    }
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
  it("returns source ranges for inline expressions and code blocks", () => {
    const template = 'A @rt.GetString("n") @{ prompter.WaitInMs(500); }';
    const ranges = collectTemplateFoldRanges(template);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toMatchObject({
      expr: 'rt.GetString("n")',
      from: 2,
      to: 20,
      isStatement: false,
    });
    expect(ranges[1]).toMatchObject({
      expr: "prompter.WaitInMs(500)",
      isStatement: true,
    });
  });
});
