import { describe, expect, it } from "vitest";
import { createHtmlPromptRenderer, createPromptRendererBridge } from "./htmlPromptRenderer";
import { createFormatMarkerRuntime } from "./formatMarkerRuntime";

describe("createHtmlPromptRenderer", () => {
  it("preserves multiple spaces in literals as nbsp", () => {
    const prompter = createHtmlPromptRenderer();
    prompter.addLiteral("a  b");
    expect(prompter.render()).toBe("a&nbsp;&nbsp;b");
  });

  it("renders literals and format markers", () => {
    const format = createFormatMarkerRuntime();
    const prompter = createHtmlPromptRenderer();

    prompter.addLiteral("Hi ");
    prompter.applyFormat(format.boldStart());
    prompter.addLiteral("there");
    prompter.applyFormat(format.boldEnd());

    expect(prompter.render()).toBe("Hi <b>there</b>");
  });

  it("applies shake mode to following literals", () => {
    const format = createFormatMarkerRuntime();
    const prompter = createHtmlPromptRenderer({ disableShake: true });

    prompter.applyFormat(format.shakePhraseStart());
    prompter.addLiteral("shaky");
    prompter.applyFormat(format.shakePhraseEnd());

    expect(prompter.render()).toBe("shaky");
  });
});

describe("createPromptRendererBridge", () => {
  it("exposes cito camelCase WaitInMs as waitInMs", () => {
    const renderer = createHtmlPromptRenderer();
    const prompter = createPromptRendererBridge(renderer);

    prompter.waitInMs(250);
    prompter.addLiteral("done");

    expect(renderer.getInstructions()).toEqual([
      { kind: "wait", milliseconds: 250 },
      { kind: "appendHtml", html: "done" },
    ]);
  });

  it("queues UpdateSpeaker for sequential prompt playback", () => {
    const renderer = createHtmlPromptRenderer();
    const prompter = createPromptRendererBridge(renderer);

    prompter.updateSpeaker("Maya");

    expect(renderer.getInstructions()).toEqual([{ kind: "updateSpeaker", template: "Maya" }]);
  });

  it("clears rendered output and instructions on reset and clear", () => {
    const renderer = createHtmlPromptRenderer();
    const prompter = createPromptRendererBridge(renderer);

    prompter.addLiteral("Hello");
    prompter.updateSpeaker("Maya");
    prompter.reset();
    prompter.addLiteral("World");
    prompter.clear();
    prompter.addLiteral("!");

    expect(renderer.render()).toBe("!");
    expect(renderer.getInstructions()).toEqual([
      { kind: "appendHtml", html: "Hello" },
      { kind: "updateSpeaker", template: "Maya" },
      { kind: "reset" },
      { kind: "appendHtml", html: "World" },
      { kind: "clear" },
      { kind: "appendHtml", html: "!" },
    ]);
  });

  it("queues WaitForContinue for sequential prompt playback", () => {
    const renderer = createHtmlPromptRenderer();
    const prompter = createPromptRendererBridge(renderer);

    prompter.waitForContinue();

    expect(renderer.getInstructions()).toEqual([{ kind: "waitForContinue" }]);
  });
});
