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
});
