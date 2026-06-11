import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../model/project";
import { DEFAULT_FONT_ID } from "../assets/defaultFont";
import { fontFamilyForAsset } from "../assets/fontFaces";
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

  it("renders font style begin/end with optional size and weight", () => {
    const project = createEmptyProject("Test");
    const format = createFormatMarkerRuntime();
    const prompter = createHtmlPromptRenderer({ project });

    prompter.applyFormat(format.fontStyleBegin("my-font", 18, 700));
    prompter.addLiteral("Styled");
    prompter.applyFormat(format.fontStyleEnd());

    const family = fontFamilyForAsset(DEFAULT_FONT_ID);
    expect(prompter.render()).toBe(
      `<span data-muselab-font="${DEFAULT_FONT_ID}" style="font-family:${family};font-size:18px;font-weight:700">Styled</span>`
    );
  });

  it("renders nested font size only inside font style", () => {
    const project = createEmptyProject("Test");
    const format = createFormatMarkerRuntime();
    const prompter = createHtmlPromptRenderer({ project });

    prompter.applyFormat(format.fontStyleBegin("my-font", 16));
    prompter.addLiteral("Normal ");
    prompter.applyFormat(format.fontSizeBegin(22));
    prompter.addLiteral("Large");
    prompter.applyFormat(format.fontSizeEnd());
    prompter.applyFormat(format.fontStyleEnd());

    const html = prompter.render();
    expect(html).toContain('style="font-size:22px">Large</span>');
    expect(html).toContain("Normal ");
  });

  it("resolves font style by assets folder path", () => {
    const project = createEmptyProject();
    project.assetGroups = [{ id: "grp-ui", name: "UI", assetType: "font" }];
    project.assets.push({
      id: "font-title",
      type: "font",
      name: "Title",
      groupId: "grp-ui",
    });

    const format = createFormatMarkerRuntime();
    const prompter = createHtmlPromptRenderer({ project });

    prompter.applyFormat(format.fontStyleByPathBegin("UI", "Title", 20));
    prompter.addLiteral("Title text");
    prompter.applyFormat(format.fontStyleEnd());

    const family = fontFamilyForAsset("font-title");
    expect(prompter.render()).toBe(
      `<span data-muselab-font="font-title" style="font-family:${family};font-size:20px">Title text</span>`
    );
  });

  it("closes nested size/weight spans when FontStyleEnd is called", () => {
    const project = createEmptyProject();
    const fontId = "024f2592-0487-4a14-9029-17184431b57e";
    project.assets.push({ id: fontId, type: "font", name: "Custom" });

    const format = createFormatMarkerRuntime();
    const prompter = createHtmlPromptRenderer({ project });

    prompter.addLiteral("Hello world! This is a ");
    prompter.applyFormat(format.fontStyleBegin(fontId));
    prompter.applyFormat(format.fontWeightBegin(900));
    prompter.applyFormat(format.fontSizeBegin(40));
    prompter.addLiteral("Test");
    prompter.applyFormat(format.fontStyleEnd());
    prompter.addLiteral("! Hello world");

    const html = prompter.render();
    const family = fontFamilyForAsset(fontId);
    expect(html).toContain(
      `<span data-muselab-font="${fontId}" style="font-family:${family}"><span style="font-weight:900"><span style="font-size:40px">Test</span></span></span>! Hello world`
    );
    expect(html.indexOf("! Hello world")).toBeGreaterThan(html.indexOf("</span></span></span>"));
  });

  it("ignores font size/weight outside font style block", () => {
    const format = createFormatMarkerRuntime();
    const prompter = createHtmlPromptRenderer();

    prompter.applyFormat(format.fontSizeBegin(22));
    prompter.addLiteral("Plain");
    prompter.applyFormat(format.fontSizeEnd());

    expect(prompter.render()).toBe("Plain");
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
