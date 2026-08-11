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

  it("toggles the dialogue box and optional character link", async () => {
    const director = new SceneDirector({ skipTransitions: true });
    expect(director.getSnapshot().dialogueVisible).toBe(true);

    await director.applyOp({ kind: "dialogue.hide" });
    expect(director.getSnapshot().dialogueVisible).toBe(false);

    await director.applyOp({ kind: "dialogue.show", characterId: "actor-1" });
    expect(director.getSnapshot().dialogueVisible).toBe(true);
    expect(director.getSnapshot().dialogueCharacterId).toBe("actor-1");
  });

  it("defaults dialogue width to half the stage and accepts setWidth", async () => {
    const director = new SceneDirector({ skipTransitions: true });
    expect(director.getSnapshot().dialogueWidthPercent).toBe(50);

    await director.applyOp({ kind: "dialogue.setWidth", widthPercent: 80 });
    expect(director.getSnapshot().dialogueWidthPercent).toBe(80);

    await expect(
      director.applyOp({ kind: "dialogue.setWidth", widthPercent: 0 })
    ).rejects.toThrow(/1 to 100/);
  });

  it("highlights multiple props independently", async () => {
    const director = new SceneDirector({ skipTransitions: true });
    await director.applyOp({ kind: "prop.add", id: "maya", assetId: "actor-1" });
    await director.applyOp({ kind: "prop.add", id: "box", assetId: "actor-1" });
    await director.applyOp({ kind: "prop.highlight", id: "maya" });
    await director.applyOp({ kind: "prop.highlight", id: "box" });
    expect(director.getSnapshot().props.map((prop) => prop.highlighted)).toEqual([true, true]);

    await director.applyOp({ kind: "prop.unhighlight", id: "maya" });
    const byId = Object.fromEntries(director.getSnapshot().props.map((prop) => [prop.id, prop.highlighted]));
    expect(byId).toEqual({ maya: false, box: true });
  });

  it("does not block later actions while a background fade is running", async () => {
    let now = 0;
    let nextHandle = 1;
    const pending = new Map<number, (time: number) => void>();
    const director = new SceneDirector({
      scheduler: {
        now: () => now,
        requestFrame: (callback) => {
          const handle = nextHandle++;
          pending.set(handle, callback);
          return handle;
        },
        cancelFrame: (handle) => {
          pending.delete(handle);
        },
      },
    });

    await director.applyOp({ kind: "bg.show", assetId: "bg-a" });
    await director.applyOp({ kind: "bg.fade", assetId: "bg-b", durationMs: 1000 });
    await director.applyOp({ kind: "dialogue.hide" });

    expect(director.getSnapshot().dialogueVisible).toBe(false);
    expect(director.getSnapshot().background?.assetId).toBe("bg-b");
    expect(director.getSnapshot().outgoingBackground?.assetId).toBe("bg-a");
    expect(director.getSnapshot().background?.opacity).toBeLessThan(1);

    now = 1000;
    for (const callback of [...pending.values()]) callback(now);
    await Promise.resolve();
    expect(director.getSnapshot().outgoingBackground).toBeNull();
    expect(director.getSnapshot().background?.opacity).toBe(1);
  });
});
