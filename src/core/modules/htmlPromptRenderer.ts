import type { FormatMarker } from "./formatMarkerRuntime";
import {
  createPromptInstructionRecorder,
  type PromptInstruction,
  type PromptInstructionRecorder,
} from "@/core/prompt/promptInstructions";
import { escapeHtml, literalTextToHtml } from "@/core/template/literalTextToHtml";

const SHAKE_CHAR_VARIANT_COUNT = 8;

export type HtmlPromptRendererOptions = {
  disableShake?: boolean;
  recorder?: PromptInstructionRecorder;
};

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

function markerToHtml(marker: FormatMarker, disableShake: boolean): string {
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
      const html = markerToHtml(marker, disableShake);
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
    Render: () => renderer.render(),
  };
}
