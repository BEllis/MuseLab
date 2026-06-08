import type { FormatMarker } from "./formatMarkerRuntime";

const SHAKE_CHAR_VARIANT_COUNT = 8;

export type HtmlPromptRendererOptions = {
  disableShake?: boolean;
};

export type PromptRenderer = {
  addLiteral(text: string): void;
  appendResult(value: unknown): void;
  applyFormat(marker: FormatMarker | null | undefined): void;
  render(): string;
};

type ShakeMode = "none" | "chars" | "phrase";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

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
  return `<span class="muselab-shake-phrase">${escapeHtml(text).replace(/\n/g, "<br>")}</span>`;
}

function literalToHtml(text: string, shakeMode: ShakeMode, disableShake: boolean): string {
  if (!text) return "";
  if (disableShake || shakeMode === "none") {
    return plainTextToHtml(text);
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
        ? plainTextToHtml(marker.text ?? "")
        : shakeCharsHtml(marker.text ?? "");
    case "shakePhraseText":
      return disableShake
        ? plainTextToHtml(marker.text ?? "")
        : shakePhraseHtml(marker.text ?? "");
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
  const parts: string[] = [];
  let shakeMode: ShakeMode = "none";

  return {
    addLiteral(text: string) {
      parts.push(literalToHtml(text, shakeMode, disableShake));
    },
    appendResult(value: unknown) {
      if (value === undefined || value === null) return;
      parts.push(String(value));
    },
    applyFormat(marker: FormatMarker | null | undefined) {
      if (!marker) return;
      const html = markerToHtml(marker, disableShake);
      if (html) {
        parts.push(html);
      }
      shakeMode = updateShakeModeFromMarker(marker, shakeMode);
    },
    render() {
      return parts.join("");
    },
  };
}

/** Bridge matching transpiled Cito PascalCase method names on MuseLabPromptRenderer. */
export function createPromptRendererBridge(renderer: PromptRenderer) {
  return {
    addLiteral: (text: string) => renderer.addLiteral(text),
    appendResult: (value: unknown) => renderer.appendResult(value),
    applyFormat: (marker: FormatMarker | null | undefined) => renderer.applyFormat(marker),
    render: () => renderer.render(),
    AddLiteral: (text: string) => renderer.addLiteral(text),
    AppendResult: (value: unknown) => renderer.appendResult(value),
    ApplyFormat: (marker: FormatMarker | null | undefined) => renderer.applyFormat(marker),
    Render: () => renderer.render(),
  };
}
