import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../model/project";
import { createPromptInstructionRecorder } from "../prompt/promptInstructions";
import { createMuseLabRuntimeBridge } from "./runtimeBridge";

function projectWithSound() {
  const project = createEmptyProject();
  project.assets.push({ id: "sfx", type: "sound", name: "SFX" });
  return project;
}

describe("MuseLab runtime bridge sound scheduling", () => {
  it("queues PlaySound for sequential prompt playback instead of playing immediately", () => {
    const project = projectWithSound();
    const recorder = createPromptInstructionRecorder();
    const played: string[] = [];
    const rt = createMuseLabRuntimeBridge({
      state: {},
      project,
      setState: () => {},
      emit: () => {},
      call: () => undefined,
      playSound: (assetId) => {
        played.push(assetId);
      },
      instructionRecorder: recorder,
    });

    rt.playSound("sfx");

    expect(played).toEqual([]);
    expect(recorder.instructions).toEqual([
      { kind: "playSound", assetId: "sfx", delaySeconds: 0 },
    ]);
  });

  it("queues PlaySoundTrim with trim options", () => {
    const project = projectWithSound();
    const recorder = createPromptInstructionRecorder();
    const rt = createMuseLabRuntimeBridge({
      state: {},
      project,
      setState: () => {},
      emit: () => {},
      call: () => undefined,
      playSound: () => {},
      instructionRecorder: recorder,
    });

    rt.playSoundTrim("sfx", 1.5, 3);

    expect(recorder.instructions).toEqual([
      { kind: "playSound", assetId: "sfx", delaySeconds: 0, startTime: 1.5, endTime: 3 },
    ]);
  });

  it("falls back to immediate playSound when no instruction recorder is available", () => {
    const project = projectWithSound();
    const played: Array<{ assetId: string; options?: { startTime?: number; endTime?: number } }> =
      [];
    const rt = createMuseLabRuntimeBridge({
      state: {},
      project,
      setState: () => {},
      emit: () => {},
      call: () => undefined,
      playSound: (assetId, options) => {
        played.push({ assetId, options });
      },
    });

    rt.playSound("sfx");

    expect(played).toEqual([{ assetId: "sfx", options: undefined }]);
  });
});
