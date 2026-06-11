import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/core/model/project";
import {
  buildTemplateCompletionModules,
  templateCompletionSource,
} from "./templateCompletions";

describe("buildTemplateCompletionModules", () => {
  it("includes built-in bindings and Format alias", () => {
    const modules = buildTemplateCompletionModules(createEmptyProject());
    const bindings = modules.map((m) => m.bindingName);
    expect(bindings).toContain("rt");
    expect(bindings).toContain("prompter");
    expect(bindings).toContain("format");
    expect(bindings).toContain("Format");
  });
});

describe("templateCompletionSource", () => {
  it("suggests bindings at start of token", () => {
    const modules = buildTemplateCompletionModules(createEmptyProject());
    const source = templateCompletionSource(modules);
    const result = source({
      matchBefore: (re: RegExp) => (re.test("rt") ? { text: "rt", from: 2, to: 4 } : null),
      explicit: false,
      pos: 4,
    } as never);
    expect(result?.options.some((o) => o.label === "rt")).toBe(true);
  });

  it("suggests methods after binding dot", () => {
    const modules = buildTemplateCompletionModules(createEmptyProject());
    const source = templateCompletionSource(modules);
    const result = source({
      matchBefore: (re: RegExp) => (re.test("rt.") ? { text: "rt.", from: 2, to: 5 } : null),
      explicit: false,
      pos: 5,
    } as never);
    expect(result?.options.some((o) => o.label === "GetString")).toBe(true);
  });
});
