import { describe, expect, it } from "vitest";
import { collectTemplateFoldRanges } from "@/core/cito/parseTemplateSurface";
import { uniqueTemplateFoldSpans } from "./templateFoldCommands";

describe("uniqueTemplateFoldSpans", () => {
  it("returns unique fold spans for inline expressions and code blocks", () => {
    const template = 'Hi @rt.GetString("name") @{ prompter.WaitInMs(500); }';
    const spans = uniqueTemplateFoldSpans(collectTemplateFoldRanges(template));
    expect(spans).toHaveLength(2);
    expect(spans[0]?.from).toBeLessThan(spans[0]?.to ?? 0);
    expect(spans[1]?.from).toBeLessThan(spans[1]?.to ?? 0);
  });
});
