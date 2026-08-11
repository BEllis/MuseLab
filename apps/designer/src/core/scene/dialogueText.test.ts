import { describe, expect, it } from "vitest";
import { validateDialogueTextIssues } from "./dialogueText";
import type { Project } from "../model/types";

const project = {
  id: "p",
  name: "Test",
  formatVersion: 7,
  locales: [{ locale: "en", name: "English" }],
  defaultLocale: "en",
  stories: [],
  modules: [],
  assets: [],
} as Project;

describe("validateDialogueTextIssues", () => {
  it("accepts tagged markup alone", () => {
    expect(validateDialogueTextIssues('<b>Hello</b> <color="red">there</color>', project)).toEqual(
      []
    );
  });

  it("accepts Razor with tags closed inside each run", () => {
    expect(
      validateDialogueTextIssues(
        'Hi @rt.GetString("name")! @if (rt.GetBool("ok")) { <b>Yes</b> }',
        project
      )
    ).toEqual([]);
  });

  it("flags markup wrapping an @ expression", () => {
    const issues = validateDialogueTextIssues('<b>Hi @rt.GetString("name")</b>', project);
    expect(issues.some((issue) => /crosses an @ expression/i.test(issue.message))).toBe(true);
    expect(issues.some((issue) => /cannot wrap/i.test(issue.message))).toBe(true);
  });

  it("flags markup wrapping an @if block", () => {
    const issues = validateDialogueTextIssues(
      '<i>@if (rt.GetBool("x")) { hello }</i>',
      project
    );
    expect(issues.some((issue) => /crosses an @if/i.test(issue.message))).toBe(true);
  });

  it("flags unclosed markup", () => {
    const issues = validateDialogueTextIssues("<b>open", project);
    expect(issues.some((issue) => /Unclosed markup tag "<b>"/i.test(issue.message))).toBe(true);
  });

  it("flags unknown markup tags", () => {
    const issues = validateDialogueTextIssues("<div>nope</div>", project);
    expect(issues.some((issue) => /Unknown tag/i.test(issue.message))).toBe(true);
  });

  it("flags Razor parse errors with a Razor: prefix", () => {
    const issues = validateDialogueTextIssues("@if (rt.GetBool(\"x\") {", project);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toMatch(/^Razor:/);
  });

  it("allows @Format helpers around expressions", () => {
    expect(
      validateDialogueTextIssues(
        '@Format.BoldStart()@rt.GetString("name")@Format.BoldEnd()',
        project
      )
    ).toEqual([]);
  });
});
