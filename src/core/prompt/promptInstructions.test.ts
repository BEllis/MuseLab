import { describe, expect, it } from "vitest";
import { createHtmlPromptRenderer } from "@/core/modules/htmlPromptRenderer";
import {
  createPromptInstructionRecorder,
  promptInstructionsNeedExecutor,
} from "./promptInstructions";

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

  it("records waitForContinue as a standalone instruction", () => {
    const recorder = createPromptInstructionRecorder();
    recorder.appendRevealText("Hi", "Hi");
    recorder.waitForContinue();
    recorder.appendRevealText(" there", " there");

    expect(recorder.instructions).toEqual([
      { kind: "appendHtml", html: "Hi" },
      { kind: "waitForContinue" },
      { kind: "appendHtml", html: " there" },
    ]);
  });

  it("records wait inside an active rate reveal block", () => {
    const recorder = createPromptInstructionRecorder();
    recorder.revealCharsBegin(-1);
    recorder.appendRevealText("Hi", "Hi");
    recorder.wait(500);
    recorder.appendRevealText(" there", " there");
    recorder.revealEnd();

    expect(recorder.instructions).toEqual([
      {
        kind: "revealHtml",
        html: "Hi",
        plainLength: 2,
        wordCount: 1,
        mode: { kind: "charsPerSecond", rate: 40 },
      },
      { kind: "wait", milliseconds: 500 },
      {
        kind: "revealHtml",
        html: " there",
        plainLength: 6,
        wordCount: 1,
        mode: { kind: "charsPerSecond", rate: 40 },
      },
    ]);
  });

  it("records reset and clear instructions", () => {
    const recorder = createPromptInstructionRecorder();
    recorder.appendRevealText("Hi", "Hi");
    recorder.updateSpeaker("Maya");
    recorder.reset();
    recorder.appendRevealText("Bye", "Bye");
    recorder.clear();
    recorder.appendRevealText("!", "!");

    expect(recorder.instructions).toEqual([
      { kind: "appendHtml", html: "Hi" },
      { kind: "updateSpeaker", template: "Maya" },
      { kind: "reset" },
      { kind: "appendHtml", html: "Bye" },
      { kind: "clear" },
      { kind: "appendHtml", html: "!" },
    ]);
  });

  it("flushes an active over-time block before reset", () => {
    const recorder = createPromptInstructionRecorder();
    recorder.revealCharsOverTimeBegin(1000);
    recorder.appendRevealText("ab", "ab");
    recorder.reset();

    expect(recorder.instructions).toEqual([
      {
        kind: "revealHtml",
        html: "ab",
        plainLength: 2,
        wordCount: 1,
        mode: { kind: "charsOverTime", durationMs: 1000 },
      },
      { kind: "reset" },
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

describe("promptInstructionsNeedExecutor", () => {
  it("uses the executor for appendHtml-only playback", () => {
    expect(
      promptInstructionsNeedExecutor([{ kind: "appendHtml", html: "Hello world" }]),
    ).toBe(true);
  });
});

describe("html prompt renderer instructions", () => {
  it("records wait between revealed segments", () => {
    const recorder = createPromptInstructionRecorder();
    const prompter = createHtmlPromptRenderer({ recorder });

    prompter.addLiteral("Hi");
    prompter.revealCharsBegin(-1);
    prompter.wait(500);
    prompter.addLiteral(" there");
    prompter.revealEnd();

    expect(prompter.getInstructions()).toEqual([
      { kind: "appendHtml", html: "Hi" },
      { kind: "wait", milliseconds: 500 },
      {
        kind: "revealHtml",
        html: " there",
        plainLength: 6,
        wordCount: 1,
        mode: { kind: "charsPerSecond", rate: 40 },
      },
    ]);
  });

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
