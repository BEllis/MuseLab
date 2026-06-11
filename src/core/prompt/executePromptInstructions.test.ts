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
