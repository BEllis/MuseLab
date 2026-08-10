import { describe, expect, it } from "vitest";
import { validateSceneActions, assertValidSceneActions } from "./validateActions";
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
    { id: "actor-1", type: "actor", name: "Maya" },
  ],
} as Project;

describe("validateSceneActions", () => {
  it("accepts a well-formed prop lifetime", () => {
    const actions: SceneAction[] = [
      { kind: "bg.show", assetId: "bg-1" },
      { kind: "prop.add", id: "maya", assetId: "actor-1" },
      { kind: "prop.show", id: "maya", position: { kind: "slot", slot: "Centre" } },
      { kind: "prop.hide", id: "maya" },
      { kind: "prop.remove", id: "maya" },
    ];
    expect(validateSceneActions(actions, { project })).toEqual([]);
  });

  it("rejects showing a prop that was never added", () => {
    const actions: SceneAction[] = [
      { kind: "prop.show", id: "ghost", position: { kind: "slot", slot: "Left" } },
    ];
    const issues = validateSceneActions(actions, { project });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/never added|no active prop|Call Prop\.Add/i);
  });

  it("rejects out-of-bounds vectors", () => {
    const actions: SceneAction[] = [
      { kind: "prop.add", id: "maya", assetId: "actor-1" },
      { kind: "prop.setPosition", id: "maya", position: { kind: "vec", x: 99, y: 0 } },
    ];
    const issues = validateSceneActions(actions, { project });
    expect(issues.some((issue) => issue.message.includes("outside the stage"))).toBe(true);
  });

  it("assertValidSceneActions throws on the first issue", () => {
    expect(() =>
      assertValidSceneActions([{ kind: "bg.show", assetId: "" }], { project })
    ).toThrow(/Choose an asset|asset/i);
  });

  it("accepts Razor expressions mixed with tagged markup", () => {
    const actions: SceneAction[] = [
      {
        kind: "dialogue.revealText",
        channel: "main",
        text: 'Hi @rt.GetString("name"). @if (rt.GetBool("flag")) { <i>ok</i> }',
        reveal: { mode: "instant" },
      },
    ];
    expect(validateSceneActions(actions, { project })).toEqual([]);
  });

  it("rejects malformed Razor in dialogue text", () => {
    const actions: SceneAction[] = [
      {
        kind: "dialogue.setSpeaker",
        text: "@if (rt.GetBool(\"x\") { broken",
      },
    ];
    const issues = validateSceneActions(actions, { project });
    expect(issues.length).toBeGreaterThan(0);
  });
});
