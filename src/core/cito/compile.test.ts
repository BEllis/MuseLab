import { describe, expect, it } from "vitest";
import { compileCondition } from "./compileCondition";
import { compileTemplate } from "./compileTemplate";

describe("compileTemplate", () => {
  it("generates a Render method with literals and Cito expressions", () => {
    const { className, ciSource } = compileTemplate(
      '<p>Hi {{ rt.GetString("name") }}</p>'
    );
    expect(className.startsWith("Template_")).toBe(true);
    expect(ciSource).toContain(`public static class ${className}`);
    expect(ciSource).toContain('return "<p>Hi " + (rt.GetString("name")) + "</p>";');
  });

  it("compiles #if blocks to ternary expressions", () => {
    const { ciSource } = compileTemplate(
      '{{#if rt.GetBool("flag")}}Yes{{/if}}'
    );
    expect(ciSource).toContain('((rt.GetBool("flag")) ? ("Yes") : (""))');
  });

  it("emits side-effect statements before return", () => {
    const { ciSource } = compileTemplate('{{ rt.SetBool("seen", true) }}Done');
    expect(ciSource).toContain('rt.SetBool("seen", true);');
    expect(ciSource).toContain('return "Done";');
  });

  it("maps Format bold tags into Cito calls", () => {
    const { ciSource } = compileTemplate(
      "{{ Format.BoldStart() }}x{{ Format.BoldEnd() }}"
    );
    expect(ciSource).toContain("(Format.BoldStart())");
    expect(ciSource).toContain('(Format.BoldEnd())');
  });
});

describe("compileCondition", () => {
  it("wraps edge conditions in Eval", () => {
    const { className, ciSource } = compileCondition('rt.GetInt("trust") >= 3');
    expect(className.startsWith("Condition_")).toBe(true);
    expect(ciSource).toContain(`public static class ${className}`);
    expect(ciSource).toContain('return rt.GetInt("trust") >= 3;');
  });
});
