import { describe, expect, it } from "vitest";
import { wrapStoryPromptTemplate, wrapStorySpeakerTemplate } from "./storyTemplateWrap";

describe("storyTemplateWrap", () => {
  it("returns the template unchanged when no wrappers are set", () => {
    expect(wrapStoryPromptTemplate({}, "Hello")).toBe("Hello");
    expect(wrapStorySpeakerTemplate({}, "Maya")).toBe("Maya");
  });

  it("wraps prompt templates with story start and end snippets", () => {
    const story = {
      promptStartTemplate: "@{ prompter.RevealWordsBegin(2); }",
      promptEndTemplate: "@{ prompter.RevealEnd(); }",
    };
    expect(wrapStoryPromptTemplate(story, "Hello")).toBe(
      "@{ prompter.RevealWordsBegin(2); }Hello@{ prompter.RevealEnd(); }"
    );
  });

  it("wraps speaker templates independently from prompts", () => {
    const story = {
      speakerStartTemplate: "@Format.BoldStart()",
      speakerEndTemplate: "@Format.BoldEnd()",
    };
    expect(wrapStorySpeakerTemplate(story, "Maya")).toBe("@Format.BoldStart()Maya@Format.BoldEnd()");
  });

  it("ignores blank wrapper strings", () => {
    const story = {
      promptStartTemplate: "   ",
      promptEndTemplate: "@{ prompter.RevealEnd(); }",
    };
    expect(wrapStoryPromptTemplate(story, "Hello")).toBe("Hello@{ prompter.RevealEnd(); }");
  });
});
