import { describe, expect, it } from "vitest";
import { SceneDirector } from "./sceneDirector";

describe("SceneDirector", () => {
  it("loads and unloads background assets across transitions", async () => {
    const loaded: string[] = [];
    const unloaded: string[] = [];
    const director = new SceneDirector({
      skipTransitions: true,
      onLoadAsset: (key) => loaded.push(key),
      onUnloadAsset: (key) => unloaded.push(key),
    });

    await director.applyOp({ kind: "bg.show", assetId: "bg-a" });
    expect(director.getSnapshot().background?.assetId).toBe("bg-a");
    expect(loaded).toContain("bg-a");

    await director.applyOp({ kind: "bg.fade", assetId: "bg-b", durationMs: 200 });
    expect(director.getSnapshot().background?.assetId).toBe("bg-b");
    expect(unloaded).toContain("bg-a");
    expect(loaded).toContain("bg-b");
  });

  it("removes hidden props at dialogue boundaries", async () => {
    const director = new SceneDirector({ skipTransitions: true });
    await director.applyOp({ kind: "prop.add", id: "maya", assetId: "actor-1" });
    await director.applyOp({
      kind: "prop.show",
      id: "maya",
      position: { kind: "slot", slot: "Left" },
    });
    await director.applyOp({ kind: "prop.hide", id: "maya" });

    const removed = director.dialogueBoundary();
    expect(removed).toEqual(["maya"]);
    expect(director.getSnapshot().props).toHaveLength(0);
  });

  it("keeps visible props across dialogue boundaries", async () => {
    const director = new SceneDirector({ skipTransitions: true });
    await director.applyOp({ kind: "prop.add", id: "maya", assetId: "actor-1" });
    await director.applyOp({
      kind: "prop.show",
      id: "maya",
      position: { kind: "slot", slot: "Centre" },
    });
    expect(director.dialogueBoundary()).toEqual([]);
    expect(director.getSnapshot().props).toHaveLength(1);
  });

  it("fails fast when operating on a missing prop", async () => {
    const director = new SceneDirector({ skipTransitions: true });
    await expect(
      director.applyOp({ kind: "prop.hide", id: "missing" })
    ).rejects.toThrow(/missing|no active prop/i);
  });
});
