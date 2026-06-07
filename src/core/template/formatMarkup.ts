const FORMAT_CALL_REGEX = /\{\{\s*([a-z_]+)\(([^)]*)\)\s*\}\}/g;

const FORMAT_FUNCTION_NAMES = new Set([
  "bold_start",
  "bold_end",
  "italic_start",
  "italic_end",
  "color_start",
  "color_end",
  "shakechars_start",
  "shakechars_end",
  "shakephrase_start",
  "shakephrase_end",
]);

const SHAKE_CHAR_VARIANT_COUNT = 8;

type ShakeMode = "none" | "chars" | "phrase";

interface FormatCall {
  name: string;
  args: string;
}

function parseFormatCall(expression: string): FormatCall | null {
  const trimmed = expression.trim();
  const match = trimmed.match(/^([a-z_]+)\(([^)]*)\)$/);
  if (!match) return null;
  return { name: match[1], args: match[2].trim() };
}

function parseColorArg(args: string): string | null {
  const trimmed = args.trim().replace(/^["']|["']$/g, "");
  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return trimmed;
  return null;
}

function isValidFormatCall(call: FormatCall): boolean {
  if (!FORMAT_FUNCTION_NAMES.has(call.name)) return false;
  if (call.name === "color_start") return parseColorArg(call.args) !== null;
  return call.args === "";
}

/** True for known styling calls like `bold_start()`; bare names like `state.x` are expressions. */
export function isFormatTag(expression: string): boolean {
  const call = parseFormatCall(expression);
  if (!call) return false;
  return isValidFormatCall(call);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCallToHtml(name: string, args: string): string {
  switch (name) {
    case "bold_start":
      return "<b>";
    case "bold_end":
      return "</b>";
    case "italic_start":
      return "<i>";
    case "italic_end":
      return "</i>";
    case "color_end":
      return "</span>";
    case "shakechars_start":
      return '<span class="muselab-shake-chars">';
    case "shakechars_end":
      return "</span>";
    case "shakephrase_start":
      return '<span class="muselab-shake-phrase">';
    case "shakephrase_end":
      return "</span>";
    case "color_start": {
      const colorHex = parseColorArg(args);
      if (!colorHex) return "";
      return `<span style="color:${colorHex}">`;
    }
    default:
      return "";
  }
}

function nextShakeMode(name: string, current: ShakeMode): ShakeMode {
  switch (name) {
    case "shakechars_start":
      return "chars";
    case "shakechars_end":
      return "none";
    case "shakephrase_start":
      return "phrase";
    case "shakephrase_end":
      return "none";
    default:
      return current;
  }
}

function isShakeFormatCall(name: string): boolean {
  return (
    name === "shakechars_start" ||
    name === "shakechars_end" ||
    name === "shakephrase_start" ||
    name === "shakephrase_end"
  );
}

function plainTextToHtml(text: string, mode: ShakeMode): string {
  if (!text) return "";

  if (mode === "chars") {
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

  return escapeHtml(text).replace(/\n/g, "<br>");
}

/** Convert markup text (after expressions) to safe HTML for the player. */
export function markupToHtml(markup: string): string {
  let html = "";
  let lastIndex = 0;
  let shakeMode: ShakeMode = "none";

  for (const match of markup.matchAll(FORMAT_CALL_REGEX)) {
    const index = match.index ?? 0;
    const plain = markup.slice(lastIndex, index);
    if (plain) {
      html += plainTextToHtml(plain, shakeMode);
    }

    const name = match[1];
    const args = match[2];
    const expression = `${name}(${args})`;
    if (!isFormatTag(expression)) {
      html += match[0];
      lastIndex = index + match[0].length;
      continue;
    }

    html += formatCallToHtml(name, args);
    if (isShakeFormatCall(name)) {
      shakeMode = nextShakeMode(name, shakeMode);
    }
    lastIndex = index + match[0].length;
  }

  const tail = markup.slice(lastIndex);
  if (tail) {
    html += plainTextToHtml(tail, shakeMode);
  }

  return html;
}
