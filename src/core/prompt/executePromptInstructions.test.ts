import { describe, expect, it, vi } from "vitest";
import {
  executePromptInstructions,
  htmlPrefixForPlainLength,
  htmlPrefixForWordCount,
} from "./executePromptInstructions";

describe("htmlPrefixForPlainLength", () => {
  it("reveals through tags without counting them", () => {
    expect(htmlPrefixForPlainLength("<b>hi</b>", 2)).toBe("<b>hi");
  });
});

describe("htmlPrefixForWordCount", () => {
  it("reveals through word boundaries", () => {
    expect(htmlPrefixForWordCount("Hello world", 1)).toBe("Hello");
    expect(htmlPrefixForWordCount("Hello world", 2)).toBe("Hello world");
  });

  it("reveals through nbsp-separated prompt html", () => {
    expect(htmlPrefixForWordCount("Something&nbsp;really&nbsp;long", 1)).toBe("Something");
    expect(htmlPrefixForWordCount("Something&nbsp;really&nbsp;long", 2)).toBe(
      "Something&nbsp;really"
    );
    expect(htmlPrefixForWordCount("Something&nbsp;really&nbsp;long", 3)).toBe(
      "Something&nbsp;really&nbsp;long"
    );
  });
});

describe("executePromptInstructions", () => {
  it("runs wait and playSound instructions in order", async () => {
    const updates: string[] = [];
    const playSound = vi.fn();

    await executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Hi" },
        { kind: "wait", milliseconds: 1 },
        { kind: "playSound", assetId: "sfx", delaySeconds: 0 },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: playSound,
    });

    expect(updates).toEqual(["Hi"]);
    expect(playSound).toHaveBeenCalledWith("sfx", undefined);
  });

  it("reveals nbsp-separated html one word at a time", async () => {
    const updates: string[] = [];

    await executePromptInstructions({
      instructions: [
        {
          kind: "revealHtml",
          html: "Something&nbsp;really&nbsp;long",
          plainLength: 21,
          wordCount: 3,
          mode: { kind: "wordsPerSecond", rate: 100 },
        },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
    });

    expect(updates).toEqual([
      "Something",
      "Something&nbsp;really",
      "Something&nbsp;really&nbsp;long",
      "Something&nbsp;really&nbsp;long",
    ]);
  });

  it("pauses and resumes reveal when the viewport is full", async () => {
    const updates: string[] = [];
    let pauseAfterWords = 2;
    let continuePlayback: (() => void) | null = null;

    const run = executePromptInstructions({
      instructions: [
        {
          kind: "revealHtml",
          html: "one two three four five",
          plainLength: 23,
          wordCount: 5,
          mode: { kind: "wordsPerSecond", rate: 1000 },
        },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      shouldPause: () => (updates.at(-1)?.trim().split(/\s+/).length ?? 0) >= pauseAfterWords,
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = resolve;
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(updates.at(-1)).toBe("one two");
    expect(continuePlayback).not.toBeNull();

    pauseAfterWords = Number.POSITIVE_INFINITY;
    continuePlayback?.();
    await run;

    expect(updates.at(-1)).toBe("one two three four five");
  });

  it("defers playSound until playback reaches that instruction", async () => {
    const playSound = vi.fn();
    let allowPlayback = false;
    let continuePlayback: (() => void) | null = null;

    const run = executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Before" },
        { kind: "playSound", assetId: "sfx", delaySeconds: 0 },
      ],
      onHtmlUpdate: () => {},
      onPlaySound: playSound,
      shouldPause: () => !allowPlayback,
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = resolve;
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(playSound).not.toHaveBeenCalled();

    allowPlayback = true;
    continuePlayback?.();
    await run;

    expect(playSound).toHaveBeenCalledWith("sfx", undefined);
  });

  it("waits for continue on explicit waitForContinue instruction", async () => {
    const updates: string[] = [];
    let continuePlayback: (() => void) | null = null;

    const run = executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Before" },
        { kind: "waitForContinue" },
        { kind: "appendHtml", html: " After" },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = resolve;
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(updates).toEqual(["Before"]);
    expect(continuePlayback).not.toBeNull();

    continuePlayback?.();
    await run;

    expect(updates.at(-1)).toBe("Before After");
  });

  it("skips reveal animation for the current chunk up to the viewport limit", async () => {
    const updates: string[] = [];
    let pauseAfterWords = 2;
    let continuePlayback: (() => void) | null = null;
    let skipRequested = false;

    const run = executePromptInstructions({
      instructions: [
        {
          kind: "revealHtml",
          html: "one two three four five",
          plainLength: 23,
          wordCount: 5,
          mode: { kind: "wordsPerSecond", rate: 1 },
        },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      shouldPause: () => (updates.at(-1)?.trim().split(/\s+/).length ?? 0) >= pauseAfterWords,
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = resolve;
        }),
      skipRevealChunk: {
        consumeSkipRequest: () => {
          if (!skipRequested) return false;
          skipRequested = false;
          return true;
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updates.at(-1)).toBe("one");

    skipRequested = true;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(updates.at(-1)).toBe("one two");
    expect(continuePlayback).not.toBeNull();

    pauseAfterWords = Number.POSITIVE_INFINITY;
    continuePlayback?.();
    await run;

    expect(updates.at(-1)).toBe("one two three four five");
  });

  it("carries skip across consecutive reveal chunks", async () => {
    const updates: string[] = [];
    let skipRequested = false;
    let skipLatched = false;

    const run = executePromptInstructions({
      instructions: [
        {
          kind: "revealHtml",
          html: "Hello ",
          plainLength: 6,
          wordCount: 1,
          mode: { kind: "wordsPerSecond", rate: 1 },
        },
        {
          kind: "revealHtml",
          html: "<b>world</b>",
          plainLength: 11,
          wordCount: 1,
          mode: { kind: "wordsPerSecond", rate: 1 },
        },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      skipRevealChunk: {
        consumeSkipRequest: () => {
          if (skipRequested) {
            skipRequested = false;
            skipLatched = true;
          }
          return skipLatched;
        },
      },
    });

    skipRequested = true;
    await run;

    expect(updates.at(-1)).toBe("Hello <b>world</b>");
  });

  it("applies a pending skip request when reveal begins", async () => {
    const updates: string[] = [];
    let skipRequested = true;

    await executePromptInstructions({
      instructions: [
        { kind: "wait", milliseconds: 1 },
        {
          kind: "revealHtml",
          html: "one two three",
          plainLength: 11,
          wordCount: 3,
          mode: { kind: "wordsPerSecond", rate: 1 },
        },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      skipRevealChunk: {
        consumeSkipRequest: () => {
          if (!skipRequested) return false;
          skipRequested = false;
          return true;
        },
      },
    });

    expect(updates.at(-1)).toBe("one two three");
  });

  it("does not skip appendHtml playback when skip is requested outside reveal", async () => {
    const updates: string[] = [];
    let skipRequested = false;

    await executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Hello" },
        { kind: "wait", milliseconds: 1 },
        { kind: "appendHtml", html: " World" },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      skipRevealChunk: {
        consumeSkipRequest: () => {
          if (!skipRequested) return false;
          skipRequested = false;
          return true;
        },
      },
    });

    skipRequested = true;
    expect(updates).toEqual(["Hello", "Hello World"]);
  });

  it("updates speaker when playback reaches updateSpeaker instruction", async () => {
    const updates: string[] = [];
    const speakerUpdates: string[] = [];
    let allowPlayback = false;
    let continuePlayback: (() => void) | null = null;

    const run = executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Hello" },
        { kind: "updateSpeaker", template: "Maya" },
        { kind: "appendHtml", html: " there" },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onSpeakerUpdate: (html) => speakerUpdates.push(html),
      renderSpeakerTemplate: async (template) => `<b>${template}</b>`,
      onPlaySound: () => {},
      shouldPause: () => !allowPlayback,
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = resolve;
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(updates).toEqual(["Hello"]);
    expect(speakerUpdates).toEqual([]);

    allowPlayback = true;
    continuePlayback?.();
    await run;

    expect(speakerUpdates).toEqual(["<b>Maya</b>"]);
    expect(updates.at(-1)).toBe("Hello there");
  });

  it("continues after wait before more appendHtml", async () => {
    const updates: string[] = [];

    await executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Hello" },
        { kind: "wait", milliseconds: 1 },
        { kind: "appendHtml", html: " World" },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
    });

    expect(updates).toEqual(["Hello", "Hello World"]);
  });
});
