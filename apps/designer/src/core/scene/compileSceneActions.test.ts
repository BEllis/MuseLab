import { describe, expect, it } from "vitest";
import { compileSceneActions } from "./compileSceneActions";
import type { SceneAction } from "./actions";
import type { Project } from "../model/types";

const project = {
  id: "p",
  name: "Test",
  formatVersion: 7,
  locales: [{ locale: "en", name: "English" }],
  defaultLocale: "en",
  stories: [],
  modules: [],
  assets: [
    { id: "bg-1", type: "backdrop", name: "Street" },
    {
      id: "actor-1",
      type: "actor",
      name: "Maya",
      expressions: [{ id: "expr-happy", name: "happy" }],
      defaultExpressionId: "expr-happy",
    },
  ],
} as Project;

describe("compileSceneActions", () => {
  it("lowers background, prop, and tagged dialogue into Cito calls", () => {
    const actions: SceneAction[] = [
      { kind: "bg.show", assetId: "bg-1" },
      { kind: "prop.add", id: "maya", assetId: "actor-1", variationId: "expr-happy" },
      { kind: "prop.show", id: "maya", position: { kind: "slot", slot: "Left" } },
      { kind: "dialogue.show", channel: "main" },
      { kind: "dialogue.setSpeaker", text: "Maya" },
      {
        kind: "dialogue.revealText",
        channel: "main",
        text: "Hello <b>world</b>",
        reveal: { mode: "instant" },
      },
      { kind: "waitForContinue" },
    ];

    const compiled = compileSceneActions(actions, project);
    expect(compiled.ciSource).toContain('bg.Show("bg-1");');
    expect(compiled.ciSource).toContain('prop.AddVariant("maya", "actor-1", "expr-happy");');
    expect(compiled.ciSource).toContain('prop.ShowAt("maya", "Left");');
    expect(compiled.ciSource).toContain('prompter.ShowDialogue("main");');
    expect(compiled.ciSource).toContain("prompter.SpeakerBegin();");
    expect(compiled.ciSource).toContain('prompter.AddLiteral("Maya");');
    expect(compiled.ciSource).toContain("prompter.SpeakerEnd();");
    expect(compiled.ciSource).toContain("format.BoldStart()");
    expect(compiled.ciSource).toContain('prompter.AddLiteral("world")');
    expect(compiled.ciSource).toContain("format.BoldEnd()");
    expect(compiled.ciSource).toContain("prompter.WaitForContinue();");
  });

  it("uses vector overloads for XY positions", () => {
    const actions: SceneAction[] = [
      { kind: "prop.add", id: "box", assetId: "actor-1" },
      { kind: "prop.move", id: "box", position: { kind: "vec", x: 4, y: 3 }, durationMs: 250 },
    ];
    const compiled = compileSceneActions(actions, project);
    expect(compiled.ciSource).toContain("prop.MoveXY(\"box\", 4, 3, 250);");
  });

  it("compiles Razor variables and @if inside dialogue text", () => {
    const actions: SceneAction[] = [
      {
        kind: "dialogue.revealText",
        channel: "main",
        text: 'Hello, @rt.GetString("name")! @if (rt.GetBool("metMaya")) { <b>Welcome back.</b> }',
        reveal: { mode: "instant" },
      },
    ];
    const compiled = compileSceneActions(actions, project);
    expect(compiled.ciSource).toContain('prompter.AddLiteral("Hello, ");');
    expect(compiled.ciSource).toContain('prompter.AppendResult((rt.GetString("name")));');
    expect(compiled.ciSource).toContain('if (rt.GetBool("metMaya")) {');
    expect(compiled.ciSource).toContain("format.BoldStart()");
    expect(compiled.ciSource).toContain('prompter.AddLiteral("Welcome back.")');
    expect(compiled.ciSource).toContain("format.BoldEnd()");
  });
});
