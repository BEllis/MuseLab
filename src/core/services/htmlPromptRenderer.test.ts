import { describe, expect, it } from "vitest";
import { createHtmlPromptRenderer } from "./htmlPromptRenderer";
import { createFormatMarkerRuntime } from "./formatMarkerRuntime";

describe("createHtmlPromptRenderer", () => {
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
