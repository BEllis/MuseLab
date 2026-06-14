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

  it("pauses and resumes reveal when shouldPause returns true", async () => {
    const updates: string[] = [];
    let continuePlayback: (() => void) | null = null;
    const plain = "one two three four five six";
    const pauseAfterStep = 10;
    let paused = false;

    const run = executePromptInstructions({
      instructions: [
        {
          kind: "revealHtml",
          html: plain,
          plainLength: plain.length,
          wordCount: 6,
          mode: { kind: "charsPerSecond", rate: 1000 },
        },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      shouldPause: () => {
        if (paused) return false;
        if (updates.length >= pauseAfterStep) {
          paused = true;
          return true;
        }
        return false;
      },
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = () => {
            resolve();
          };
        }),
    });

    for (let attempt = 0; attempt < 50 && continuePlayback === null; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(continuePlayback).not.toBeNull();
    expect(updates.at(-1)).toBe(htmlPrefixForPlainLength(plain, pauseAfterStep));

    continuePlayback?.();
    await run;

    expect(updates.at(-1)).toBe(plain);
  });

  it("shows appendHtml in one burst without onRevealActiveChange", async () => {
    const updates: string[] = [];
    const revealActive: boolean[] = [];
    const plain = "Hello world";

    await executePromptInstructions({
      instructions: [{ kind: "appendHtml", html: plain }],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      waitForContinue: () => Promise.resolve(),
      onRevealActiveChange: (active) => revealActive.push(active),
    });

    expect(updates).toEqual([plain]);
    expect(revealActive).toEqual([]);
  });

  it("pauses appendHtml at visual-line boundaries using word bursts", async () => {
    const updates: string[] = [];
    let continuePlayback: (() => void) | null = null;
    let linesAtLastContinue = 0;
    const plain = "one two three four five";

    const measureVisualLinesAtHtml = (html: string) => {
      const text = html.replace(/<[^>]*>/g, "");
      if (!text.trim()) return 0;
      return text.trim().split(/\s+/).length;
    };

    const run = executePromptInstructions({
      instructions: [{ kind: "appendHtml", html: plain }],
      onHtmlUpdate: (html) => updates.push(html),
      onPlaySound: () => {},
      measureVisualLinesAtHtml,
      getLinesAtLastContinue: () => linesAtLastContinue,
      continuationVisualLineInterval: 3,
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = () => {
            linesAtLastContinue = measureVisualLinesAtHtml(updates.at(-1) ?? "");
            resolve();
          };
        }),
    });

    for (let attempt = 0; attempt < 50 && continuePlayback === null; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(continuePlayback).not.toBeNull();
    expect(updates.at(-1)).toBe("one two three");

    continuePlayback?.();
    await run;

    expect(updates.at(-1)).toBe(plain);
  });

  it("defers playSound until an explicit waitForContinue instruction", async () => {
    const playSound = vi.fn();
    let continuePlayback: (() => void) | null = null;

    const run = executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Before" },
        { kind: "waitForContinue" },
        { kind: "playSound", assetId: "sfx", delaySeconds: 0 },
      ],
      onHtmlUpdate: () => {},
      onPlaySound: playSound,
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = () => {
            resolve();
          };
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(playSound).not.toHaveBeenCalled();

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
          continuePlayback = () => {
            resolve();
          };
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(updates.at(-1)).toBe("Before");
    expect(continuePlayback).not.toBeNull();

    continuePlayback?.();
    await run;

    expect(updates.at(-1)).toBe("Before After");
  });

  it("skips reveal animation for the current chunk", async () => {
    const updates: string[] = [];
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
    let continuePlayback: (() => void) | null = null;

    const run = executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Hello" },
        { kind: "waitForContinue" },
        { kind: "updateSpeaker", template: "Maya" },
        { kind: "appendHtml", html: " there" },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onSpeakerUpdate: (html) => speakerUpdates.push(html),
      renderSpeakerTemplate: async (template) => `<b>${template}</b>`,
      onPlaySound: () => {},
      waitForContinue: () =>
        new Promise<void>((resolve) => {
          continuePlayback = () => {
            resolve();
          };
        }),
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(updates.at(-1)).toBe("Hello");
    expect(speakerUpdates).toEqual([]);

    continuePlayback?.();
    await run;

    expect(speakerUpdates).toEqual(["<b>Maya</b>"]);
    expect(updates.at(-1)).toBe("Hello there");
  });

  it("resets prompt text and speaker during playback", async () => {
    const updates: string[] = [];
    const speakerUpdates: string[] = [];

    await executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Hello" },
        { kind: "updateSpeaker", template: "Maya" },
        { kind: "reset" },
        { kind: "appendHtml", html: "Fresh" },
      ],
      initialSpeakerHtml: "<i>Unknown</i>",
      onHtmlUpdate: (html) => updates.push(html),
      onSpeakerUpdate: (html) => speakerUpdates.push(html),
      renderSpeakerTemplate: async (template) => `<b>${template}</b>`,
      onPlaySound: () => {},
    });

    expect(updates).toEqual(["Hello", "", "Fresh"]);
    expect(speakerUpdates).toEqual(["<b>Maya</b>", "<i>Unknown</i>"]);
  });

  it("clears prompt text but keeps speaker during playback", async () => {
    const updates: string[] = [];
    const speakerUpdates: string[] = [];

    await executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Hello" },
        { kind: "updateSpeaker", template: "Maya" },
        { kind: "clear" },
        { kind: "appendHtml", html: "Again" },
      ],
      onHtmlUpdate: (html) => updates.push(html),
      onSpeakerUpdate: (html) => speakerUpdates.push(html),
      renderSpeakerTemplate: async (template) => `<b>${template}</b>`,
      onPlaySound: () => {},
    });

    expect(updates).toEqual(["Hello", "", "Again"]);
    expect(speakerUpdates).toEqual(["<b>Maya</b>"]);
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

  it("signals reveal active only for explicit revealHtml instructions", async () => {
    const revealActive: boolean[] = [];

    await executePromptInstructions({
      instructions: [
        { kind: "appendHtml", html: "Plain" },
        {
          kind: "revealHtml",
          html: "Reveal",
          plainLength: 6,
          wordCount: 1,
          mode: { kind: "charsPerSecond", rate: 1000 },
        },
      ],
      onHtmlUpdate: () => {},
      onPlaySound: () => {},
      onRevealActiveChange: (active) => revealActive.push(active),
    });

    expect(revealActive).toEqual([true, false]);
  });
});
