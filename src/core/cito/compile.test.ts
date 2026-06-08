import { describe, expect, it } from "vitest";
import { compileCondition } from "./compileCondition";
import { compileTemplate } from "./compileTemplate";
import { createEmptyProject } from "../model/project";

const project = createEmptyProject();

describe("compileTemplate", () => {
  it("generates a Render method with prompter calls", () => {
    const { className, ciSource } = compileTemplate(
      '<p>Hi {{ rt.GetString("name") }}</p>',
      project
    );
    expect(className.startsWith("Template_")).toBe(true);
    expect(ciSource).toContain(`public static class ${className}`);
    expect(ciSource).toContain('prompter.AddLiteral("<p>Hi ");');
    expect(ciSource).toContain('prompter.AppendResult((rt.GetString("name")));');
    expect(ciSource).toContain('prompter.AddLiteral("</p>");');
    expect(ciSource).toContain("return prompter.Render();");
  });

  it("compiles #if blocks to conditional prompter calls", () => {
    const { ciSource } = compileTemplate('{{#if rt.GetBool("flag")}}Yes{{/if}}', project);
    expect(ciSource).toContain('if (rt.GetBool("flag")) {');
    expect(ciSource).toContain('prompter.AddLiteral("Yes");');
  });

  it("emits side-effect statements before return", () => {
    const { ciSource } = compileTemplate('{{ rt.SetBool("seen", true) }}Done', project);
    expect(ciSource).toContain('rt.SetBool("seen", true);');
    expect(ciSource).toContain('prompter.AddLiteral("Done");');
    expect(ciSource).toContain("return prompter.Render();");
  });

  it("maps Format tags into ApplyFormat calls", () => {
    const { ciSource } = compileTemplate(
      "{{ Format.BoldStart() }}x{{ Format.BoldEnd() }}",
      project
    );
    expect(ciSource).toContain("prompter.ApplyFormat(format.BoldStart());");
    expect(ciSource).toContain('prompter.AddLiteral("x");');
    expect(ciSource).toContain("prompter.ApplyFormat(format.BoldEnd());");
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
