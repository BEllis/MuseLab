import { describe, expect, it } from "vitest";
import { compileCondition } from "./compileCondition";
import { compileTemplate } from "./compileTemplate";
import { RazorTemplateParseError } from "./parseTemplateSurface";
import { createEmptyProject } from "../model/project";

const project = createEmptyProject();

describe("compileTemplate", () => {
  it("generates a Render method with prompter calls", () => {
    const { className, ciSource } = compileTemplate(
      '<p>Hi @rt.GetString("name")</p>',
      project
    );
    expect(className.startsWith("Template_")).toBe(true);
    expect(ciSource).toContain(`public static class ${className}`);
    expect(ciSource).toContain('prompter.AddLiteral("<p>Hi ");');
    expect(ciSource).toContain('prompter.AppendResult((rt.GetString("name")));');
    expect(ciSource).toContain('prompter.AddLiteral("</p>");');
    expect(ciSource).toContain("return prompter.Render();");
  });

  it("compiles @if blocks to conditional prompter calls", () => {
    const { ciSource } = compileTemplate('@if (rt.GetBool("flag")) { Yes }', project);
    expect(ciSource).toContain('if (rt.GetBool("flag")) {');
    expect(ciSource).toContain('prompter.AddLiteral(" Yes ");');
  });

  it("emits side-effect statements before return", () => {
    const { ciSource } = compileTemplate('@{ rt.SetBool("seen", true); }Done', project);
    expect(ciSource).toContain('rt.SetBool("seen", true);');
    expect(ciSource).toContain('prompter.AddLiteral("Done");');
    expect(ciSource).toContain("return prompter.Render();");
  });

  it("treats prompter timing and PlaySoundClip calls as statements", () => {
    const { ciSource } = compileTemplate(
      '@{ prompter.WaitInMs(250); prompter.RevealCharsBegin(-1); }x@{ prompter.RevealEnd(); rt.PlaySoundClip("sfx", 0, -1, -1); }',
      project
    );
    expect(ciSource).toContain("prompter.WaitInMs(250);");
    expect(ciSource).toContain("prompter.RevealCharsBegin(-1);");
    expect(ciSource).toContain("prompter.RevealEnd();");
    expect(ciSource).toContain('rt.PlaySoundClip("sfx", 0, -1, -1);');
  });

  it("compiles bare @ output expressions to AppendResult", () => {
    const { ciSource } = compileTemplate('Points: @rt.GetInt("score")', project);
    expect(ciSource).toContain('prompter.AddLiteral("Points: ");');
    expect(ciSource).toContain('prompter.AppendResult((rt.GetInt("score")));');
  });

  it("maps Format tags into ApplyFormat calls", () => {
    const { ciSource } = compileTemplate("@Format.BoldStart()x@Format.BoldEnd()", project);
    expect(ciSource).toContain("prompter.ApplyFormat(format.BoldStart());");
    expect(ciSource).toContain('prompter.AddLiteral("x");');
    expect(ciSource).toContain("prompter.ApplyFormat(format.BoldEnd());");
  });

  it("maps lowercase format tags into ApplyFormat calls", () => {
    const { ciSource } = compileTemplate(
      "@format.ShakeCharsStart()Hello@format.ShakeCharsEnd()",
      project,
    );
    expect(ciSource).toContain("prompter.ApplyFormat(format.ShakeCharsStart());");
    expect(ciSource).toContain('prompter.AddLiteral("Hello");');
    expect(ciSource).toContain("prompter.ApplyFormat(format.ShakeCharsEnd());");
    expect(ciSource).not.toContain("AppendResult((format.");
  });

  it("rejects side-effect bare @ output at compile time", () => {
    expect(() => compileTemplate("@prompter.WaitInMs(500)", project)).toThrow(RazorTemplateParseError);
  });

  it("rejects mistaken @ in plain text at compile time", () => {
    expect(() => compileTemplate("user@host.com", project)).toThrow(RazorTemplateParseError);
    expect(() => compileTemplate("user@host.com", project)).toThrow(/@@/);
  });

  it("still parses code blocks immediately after text", () => {
    const { ciSource } = compileTemplate('Done@{ prompter.RevealEnd(); }', project);
    expect(ciSource).toContain('prompter.AddLiteral("Done");');
    expect(ciSource).toContain("prompter.RevealEnd();");
  });
});

describe("compileCondition", () => {
  it("wraps edge conditions in Eval", () => {
    const { className, ciSource } = compileCondition('rt.GetInt("trust") >= 3', project);
    expect(className.startsWith("Condition_")).toBe(true);
    expect(ciSource).toContain(`public static class ${className}`);
    expect(ciSource).toContain('return rt.GetInt("trust") >= 3;');
  });
});
