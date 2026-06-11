import { EditorState } from "@codemirror/state";
import type { CompletionContext } from "@codemirror/autocomplete";
import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/core/model/project";
import {
  buildTemplateCompletionModules,
  templateCompletionSource,
} from "./templateCompletions";

function createContext(doc: string, pos: number = doc.length, explicit = false): CompletionContext {
  const state = EditorState.create({ doc });
  return {
    state,
    pos,
    explicit,
    matchBefore: (re: RegExp) => {
      const text = doc.slice(0, pos);
      const match = text.match(re);
      if (!match) return null;
      const matched = match[0];
      return { text: matched, from: pos - matched.length, to: pos };
    },
  } as CompletionContext;
}

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
  const modules = buildTemplateCompletionModules(createEmptyProject());
  const source = templateCompletionSource(modules);

  it("suggests bindings after @", () => {
    const result = source(createContext("Hello @r"));
    expect(result?.options.some((o) => o.label === "rt")).toBe(true);
  });

  it("suggests methods after binding dot inside @ block", () => {
    const result = source(createContext("Hello @rt."));
    expect(result?.options.some((o) => o.label === "GetString")).toBe(true);
  });

  it("does not suggest after a space in literal text", () => {
    expect(source(createContext("Hello "))).toBeNull();
  });

  it("does not suggest after a space inside an @ block", () => {
    expect(source(createContext("@{ prompter. "))).toBeNull();
  });

  it("does not suggest for escaped at signs", () => {
    expect(source(createContext("Email @@"))).toBeNull();
  });

  it("allows explicit completion inside an @ block", () => {
    const result = source(createContext("@{ prompter. ", 13, true));
    expect(result?.options.some((o) => o.label === "WaitInMs")).toBe(true);
  });
});
