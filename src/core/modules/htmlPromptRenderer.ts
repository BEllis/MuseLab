import type { Project } from "../model/types";
import type { FormatMarker } from "./formatMarkerRuntime";
import {
  createPromptInstructionRecorder,
  type PromptInstruction,
  type PromptInstructionRecorder,
} from "@/core/prompt/promptInstructions";
import { escapeHtml, literalTextToHtml } from "@/core/template/literalTextToHtml";
import { resolveFontId } from "../assets/defaultFont";
import { fontFamilyForAsset } from "../assets/fontFaces";
import { resolveFontAssetId } from "../assets/resolveFontAsset";

const SHAKE_CHAR_VARIANT_COUNT = 8;

export type HtmlPromptRendererOptions = {
  project?: Project;
  disableShake?: boolean;
  recorder?: PromptInstructionRecorder;
};

type FontRenderContext = {
  project?: Project;
  /** Unclosed FontSizeBegin/FontWeightBegin count per open FontStyleBegin block. */
  fontBlockNestedSpans: number[];
};

function closeOpenFontBlock(fontContext: FontRenderContext): string {
  const nested = fontContext.fontBlockNestedSpans.pop();
  if (nested === undefined) return "";
  return `${"</span>".repeat(nested)}</span>`;
}

export type PromptRenderer = {
  addLiteral(text: string): void;
  appendResult(value: unknown): void;
  applyFormat(marker: FormatMarker | null | undefined): void;
  wait(milliseconds: number): void;
  revealCharsBegin(charsPerSecond: number): void;
  revealWordsBegin(wordsPerSecond: number): void;
  revealCharsOverTimeBegin(durationMs: number): void;
  revealWordsOverTimeBegin(durationMs: number): void;
  revealEnd(): void;
  waitForContinue(): void;
  updateSpeaker(template: string): void;
  reset(): void;
  clear(): void;
  render(): string;
  getInstructions(): PromptInstruction[];
};

type ShakeMode = "none" | "chars" | "phrase";

function shakeCharsHtml(text: string): string {
  let html = "";
  for (const char of text) {
    if (char === "\n") {
      html += "<br>";
      continue;
    }
    if (char === " ") {
      html += " ";
      continue;
    }
    const variant = Math.floor(Math.random() * SHAKE_CHAR_VARIANT_COUNT);
    html += `<span class="muselab-shake-char muselab-shake-char-v${variant}">${escapeHtml(char)}</span>`;
  }
  return html;
}

function shakePhraseHtml(text: string): string {
  return `<span class="muselab-shake-phrase">${literalTextToHtml(text)}</span>`;
}

function literalToHtml(text: string, shakeMode: ShakeMode, disableShake: boolean): string {
  if (!text) return "";
  if (disableShake || shakeMode === "none") {
    return literalTextToHtml(text);
  }
  if (shakeMode === "chars") {
    return shakeCharsHtml(text);
  }
  return shakePhraseHtml(text);
}

function isValidFontSize(px: number | undefined): boolean {
  return typeof px === "number" && Number.isInteger(px) && px >= 1 && px <= 200;
}

function isValidFontWeight(weight: number | undefined): boolean {
  return (
    typeof weight === "number" &&
    Number.isInteger(weight) &&
    weight >= 100 &&
    weight <= 900 &&
    weight % 100 === 0
  );
}

function buildFontStyleOpen(marker: FormatMarker, project?: Project): string {
  const fontAssetId = project
    ? resolveFontId(project, marker.fontAssetId ?? "")
    : (marker.fontAssetId ?? "");
  const family = fontFamilyForAsset(fontAssetId);
  const styles = [`font-family:${family}`];
  if (isValidFontSize(marker.fontSizePx)) {
    styles.push(`font-size:${marker.fontSizePx}px`);
  }
  if (isValidFontWeight(marker.fontWeight)) {
    styles.push(`font-weight:${marker.fontWeight}`);
  }
  return `<span data-muselab-font="${escapeHtml(fontAssetId)}" style="${styles.join(";")}">`;
}

function markerToHtml(
  marker: FormatMarker,
  disableShake: boolean,
  fontContext: FontRenderContext
): string {
  switch (marker.kind) {
    case "boldStart":
      return "<b>";
    case "boldEnd":
      return "</b>";
    case "italicStart":
      return "<i>";
    case "italicEnd":
      return "</i>";
    case "colorStart": {
      const colorHex = marker.colorHex ?? "";
      if (!/^#[0-9A-Fa-f]{3,8}$/.test(colorHex)) return "";
      return `<span style="color:${colorHex}">`;
    }
    case "colorEnd":
      return "</span>";
    case "shakeCharsStart":
      return disableShake ? "" : '<span class="muselab-shake-chars">';
    case "shakeCharsEnd":
      return disableShake ? "" : "</span>";
    case "shakePhraseStart":
      return disableShake ? "" : '<span class="muselab-shake-phrase">';
    case "shakePhraseEnd":
      return disableShake ? "" : "</span>";
    case "shakeCharsText":
      return disableShake
        ? literalTextToHtml(marker.text ?? "")
        : shakeCharsHtml(marker.text ?? "");
    case "shakePhraseText":
      return disableShake
        ? literalTextToHtml(marker.text ?? "")
        : shakePhraseHtml(marker.text ?? "");
    case "fontStyleBegin": {
      if (!marker.fontAssetId) return "";
      fontContext.fontBlockNestedSpans.push(0);
      return buildFontStyleOpen(marker, fontContext.project);
    }
    case "fontStyleByPathBegin": {
      if (!marker.fontGroupPath || !marker.fontAssetName || !fontContext.project) return "";
      const fontAssetId = resolveFontAssetId(
        fontContext.project,
        marker.fontGroupPath,
        marker.fontAssetName
      );
      fontContext.fontBlockNestedSpans.push(0);
      return buildFontStyleOpen(
        {
          kind: "fontStyleBegin",
          fontAssetId,
          fontSizePx: marker.fontSizePx,
          fontWeight: marker.fontWeight,
        },
        fontContext.project
      );
    }
    case "fontStyleEnd":
      return closeOpenFontBlock(fontContext);
    case "fontSizeBegin": {
      const nested = fontContext.fontBlockNestedSpans.at(-1);
      if (nested === undefined || !isValidFontSize(marker.fontSizePx)) return "";
      fontContext.fontBlockNestedSpans[fontContext.fontBlockNestedSpans.length - 1] = nested + 1;
      return `<span style="font-size:${marker.fontSizePx}px">`;
    }
    case "fontSizeEnd": {
      const nested = fontContext.fontBlockNestedSpans.at(-1);
      if (nested === undefined || nested <= 0) return "";
      fontContext.fontBlockNestedSpans[fontContext.fontBlockNestedSpans.length - 1] = nested - 1;
      return "</span>";
    }
    case "fontWeightBegin": {
      const nested = fontContext.fontBlockNestedSpans.at(-1);
      if (nested === undefined || !isValidFontWeight(marker.fontWeight)) return "";
      fontContext.fontBlockNestedSpans[fontContext.fontBlockNestedSpans.length - 1] = nested + 1;
      return `<span style="font-weight:${marker.fontWeight}">`;
    }
    case "fontWeightEnd": {
      const nested = fontContext.fontBlockNestedSpans.at(-1);
      if (nested === undefined || nested <= 0) return "";
      fontContext.fontBlockNestedSpans[fontContext.fontBlockNestedSpans.length - 1] = nested - 1;
      return "</span>";
    }
    default:
      return "";
  }
}

function markerPlainText(marker: FormatMarker): string {
  switch (marker.kind) {
    case "shakeCharsText":
    case "shakePhraseText":
      return marker.text ?? "";
    default:
      return "";
  }
}

function updateShakeModeFromMarker(marker: FormatMarker, mode: ShakeMode): ShakeMode {
  switch (marker.kind) {
    case "shakeCharsStart":
      return "chars";
    case "shakeCharsEnd":
      return "none";
    case "shakePhraseStart":
      return "phrase";
    case "shakePhraseEnd":
      return "none";
    default:
      return mode;
  }
}

export function createHtmlPromptRenderer(
  options: HtmlPromptRendererOptions = {}
): PromptRenderer {
  const disableShake = options.disableShake ?? false;
  const recorder = options.recorder ?? createPromptInstructionRecorder();
  const parts: string[] = [];
  let shakeMode: ShakeMode = "none";
  const fontContext: FontRenderContext = {
    project: options.project,
    fontBlockNestedSpans: [],
  };

  const pushHtml = (html: string, plainText: string) => {
    if (!html) return;
    parts.push(html);
    recorder.appendRevealText(html, plainText);
  };

  return {
    addLiteral(text: string) {
      pushHtml(literalToHtml(text, shakeMode, disableShake), text);
    },
    appendResult(value: unknown) {
      if (value === undefined || value === null) return;
      const text = String(value);
      pushHtml(text, text);
    },
    applyFormat(marker: FormatMarker | null | undefined) {
      if (!marker) return;
      const html = markerToHtml(marker, disableShake, fontContext);
      if (html) {
        pushHtml(html, markerPlainText(marker));
      }
      shakeMode = updateShakeModeFromMarker(marker, shakeMode);
    },
    wait(milliseconds: number) {
      recorder.wait(milliseconds);
    },
    revealCharsBegin(charsPerSecond: number) {
      recorder.revealCharsBegin(charsPerSecond);
    },
    revealWordsBegin(wordsPerSecond: number) {
      recorder.revealWordsBegin(wordsPerSecond);
    },
    revealCharsOverTimeBegin(durationMs: number) {
      recorder.revealCharsOverTimeBegin(durationMs);
    },
    revealWordsOverTimeBegin(durationMs: number) {
      recorder.revealWordsOverTimeBegin(durationMs);
    },
    revealEnd() {
      recorder.revealEnd();
    },
    waitForContinue() {
      recorder.waitForContinue();
    },
    updateSpeaker(template: string) {
      recorder.updateSpeaker(template);
    },
    reset() {
      parts.length = 0;
      shakeMode = "none";
      fontContext.fontBlockNestedSpans = [];
      recorder.reset();
    },
    clear() {
      parts.length = 0;
      shakeMode = "none";
      fontContext.fontBlockNestedSpans = [];
      recorder.clear();
    },
    render() {
      return parts.join("");
    },
    getInstructions() {
      return recorder.instructions;
    },
  };
}

/** Bridge matching transpiled Cito PascalCase method names on MuseLabPromptRenderer. */
export function createPromptRendererBridge(renderer: PromptRenderer) {
  return {
    addLiteral: (text: string) => renderer.addLiteral(text),
    appendResult: (value: unknown) => renderer.appendResult(value),
    applyFormat: (marker: FormatMarker | null | undefined) => renderer.applyFormat(marker),
    wait: (milliseconds: number) => renderer.wait(milliseconds),
    waitInMs: (milliseconds: number) => renderer.wait(milliseconds),
    revealCharsBegin: (charsPerSecond: number) => renderer.revealCharsBegin(charsPerSecond),
    revealWordsBegin: (wordsPerSecond: number) => renderer.revealWordsBegin(wordsPerSecond),
    revealCharsOverTimeBegin: (durationMs: number) => renderer.revealCharsOverTimeBegin(durationMs),
    revealWordsOverTimeBegin: (durationMs: number) => renderer.revealWordsOverTimeBegin(durationMs),
    revealEnd: () => renderer.revealEnd(),
    waitForContinue: () => renderer.waitForContinue(),
    updateSpeaker: (template: string) => renderer.updateSpeaker(template),
    reset: () => renderer.reset(),
    clear: () => renderer.clear(),
    render: () => renderer.render(),
    AddLiteral: (text: string) => renderer.addLiteral(text),
    AppendResult: (value: unknown) => renderer.appendResult(value),
    ApplyFormat: (marker: FormatMarker | null | undefined) => renderer.applyFormat(marker),
    WaitInMs: (milliseconds: number) => renderer.wait(milliseconds),
    RevealCharsBegin: (charsPerSecond: number) => renderer.revealCharsBegin(charsPerSecond),
    RevealWordsBegin: (wordsPerSecond: number) => renderer.revealWordsBegin(wordsPerSecond),
    RevealCharsOverTimeBegin: (durationMs: number) => renderer.revealCharsOverTimeBegin(durationMs),
    RevealWordsOverTimeBegin: (durationMs: number) => renderer.revealWordsOverTimeBegin(durationMs),
    RevealEnd: () => renderer.revealEnd(),
    WaitForContinue: () => renderer.waitForContinue(),
    UpdateSpeaker: (template: string) => renderer.updateSpeaker(template),
    Reset: () => renderer.reset(),
    Clear: () => renderer.clear(),
    Render: () => renderer.render(),
  };
}
