const SHAKE_CHAR_VARIANT_COUNT = 8;

export type FormatRuntimeOptions = {
  /** When true, shake tags render as plain text (for canvas thumbnails). */
  disableShake?: boolean;
};

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

/** JS Format implementation merged into transpiled Cito output at runtime. */
export function createFormatRuntime(options: FormatRuntimeOptions = {}) {
  const disableShake = options.disableShake ?? false;

  return {
    boldStart(): string {
      return "<b>";
    },
    boldEnd(): string {
      return "</b>";
    },
    italicStart(): string {
      return "<i>";
    },
    italicEnd(): string {
      return "</i>";
    },
    colorStart(colorHex: string): string {
      if (!/^#[0-9A-Fa-f]{3,8}$/.test(colorHex)) return "";
      return `<span style="color:${colorHex}">`;
    },
    colorEnd(): string {
      return "</span>";
    },
    shakeCharsStart(): string {
      return disableShake ? "" : '<span class="muselab-shake-chars">';
    },
    shakeCharsEnd(): string {
      return disableShake ? "" : "</span>";
    },
    shakePhraseStart(): string {
      return disableShake ? "" : '<span class="muselab-shake-phrase">';
    },
    shakePhraseEnd(): string {
      return disableShake ? "" : "</span>";
    },
    shakeCharsText(text: string): string {
      return disableShake ? plainTextToHtml(text) : shakeCharsHtml(text);
    },
    shakePhraseText(text: string): string {
      return disableShake ? plainTextToHtml(text) : shakePhraseHtml(text);
    },
  };
}

export const formatRuntime = createFormatRuntime();

export type FormatRuntime = ReturnType<typeof createFormatRuntime>;
