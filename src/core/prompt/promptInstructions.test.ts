import { describe, expect, it } from "vitest";
import { createHtmlPromptRenderer } from "@/core/modules/htmlPromptRenderer";
import { createPromptInstructionRecorder } from "./promptInstructions";

describe("createPromptInstructionRecorder", () => {
  it("records instant and revealed text in order", () => {
    const recorder = createPromptInstructionRecorder();
    recorder.appendRevealText("Hi ", "Hi ");
    recorder.revealCharsBegin(-1);
    recorder.appendRevealText("slow", "slow");
    recorder.revealEnd();
    recorder.wait(500);
    recorder.appendRevealText("!", "!");

    expect(recorder.instructions).toEqual([
      { kind: "appendHtml", html: "Hi " },
      {
        kind: "revealHtml",
        html: "slow",
        plainLength: 4,
        wordCount: 1,
        mode: { kind: "charsPerSecond", rate: 40 },
      },
      { kind: "wait", milliseconds: 500 },
      { kind: "appendHtml", html: "!" },
    ]);
  });

  it("collapses over-time reveal blocks on RevealEnd", () => {
    const recorder = createPromptInstructionRecorder();
    recorder.revealCharsOverTimeBegin(1200);
    recorder.appendRevealText("ab", "ab");
    recorder.playSound("sound-1", 0, -1, -1);
    recorder.appendRevealText("cd", "cd");
    recorder.revealEnd();

    expect(recorder.instructions).toEqual([
      {
        kind: "revealHtml",
        html: "ab",
        plainLength: 2,
        wordCount: 1,
        mode: { kind: "charsOverTime", durationMs: 600 },
      },
      {
        kind: "playSound",
        assetId: "sound-1",
        delaySeconds: 0,
      },
      {
        kind: "revealHtml",
        html: "cd",
        plainLength: 2,
        wordCount: 1,
        mode: { kind: "charsOverTime", durationMs: 600 },
      },
    ]);
  });
});

describe("html prompt renderer instructions", () => {
  it("records playSoundClip placement via shared recorder", () => {
    const recorder = createPromptInstructionRecorder();
    const prompter = createHtmlPromptRenderer({ recorder });

    prompter.addLiteral("A");
    recorder.playSound("sfx", 0.5, 1, 2);
    prompter.addLiteral("B");

    expect(prompter.getInstructions()).toEqual([
      { kind: "appendHtml", html: "A" },
      {
        kind: "playSound",
        assetId: "sfx",
        delaySeconds: 0.5,
        startTime: 1,
        endTime: 2,
      },
      { kind: "appendHtml", html: "B" },
    ]);
  });
});
