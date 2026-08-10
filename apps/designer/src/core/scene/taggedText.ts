/**
 * Author-facing inline markup for dialogue text.
 *
 * Supported: <b> <i> <u> <shake> <color="red"> and their closing tags.
 * This is never stored as Cito; the scene compiler lowers it to Format.* calls.
 */

export const TAGGED_TEXT_TAGS = ["b", "i", "u", "shake", "color"] as const;

export type TaggedTextTag = (typeof TAGGED_TEXT_TAGS)[number];

export type TaggedTextNode =
  | { kind: "text"; text: string }
  | { kind: "open"; tag: TaggedTextTag; color?: string }
  | { kind: "close"; tag: TaggedTextTag };

export class TaggedTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaggedTextError";
  }
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  navy: "#000080",
  purple: "#800080",
  teal: "#008080",
  orange: "#ffa500",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gold: "#ffd700",
};

/** Normalize an author color (named or hex) into the #rrggbb form Format expects. */
export function normalizeColor(raw: string): string {
  const value = raw.trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (!value) {
    throw new TaggedTextError("Color tag is missing a value, e.g. <color=\"red\">.");
  }
  if (value.startsWith("#")) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(value)) {
      throw new TaggedTextError(`Invalid hex color "${raw}". Use #rgb, #rrggbb, or #rrggbbaa.`);
    }
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return value;
  }
  const named = NAMED_COLORS[value];
  if (!named) {
    throw new TaggedTextError(
      `Unknown color "${raw}". Use a hex value like #ff0000 or one of: ${Object.keys(NAMED_COLORS).join(", ")}.`
    );
  }
  return named;
}

function isTaggedTextTag(value: string): value is TaggedTextTag {
  return (TAGGED_TEXT_TAGS as readonly string[]).includes(value);
}

/**
 * Parse tagged dialogue text into an ordered node list.
 * Throws on unknown tags, unbalanced tags, or malformed color values.
 */
export function parseTaggedText(input: string): TaggedTextNode[] {
  const nodes: TaggedTextNode[] = [];
  const openStack: TaggedTextTag[] = [];
  let buffer = "";
  let index = 0;

  const flushText = () => {
    if (buffer) {
      nodes.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };

  while (index < input.length) {
    const char = input[index];

    if (char !== "<") {
      buffer += char;
      index += 1;
      continue;
    }

    const end = input.indexOf(">", index);
    if (end === -1) {
      throw new TaggedTextError(
        `Unclosed tag starting at position ${index}. Escape a literal "<" as "&lt;".`
      );
    }

    const raw = input.slice(index + 1, end).trim();
    index = end + 1;

    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().toLowerCase();
      if (!isTaggedTextTag(name)) {
        throw new TaggedTextError(
          `Unknown closing tag "</${name}>". Supported tags: ${TAGGED_TEXT_TAGS.join(", ")}.`
        );
      }
      const expected = openStack.pop();
      if (expected === undefined) {
        throw new TaggedTextError(`Closing tag "</${name}>" has no matching opening tag.`);
      }
      if (expected !== name) {
        throw new TaggedTextError(
          `Closing tag "</${name}>" does not match the currently open "<${expected}>".`
        );
      }
      flushText();
      nodes.push({ kind: "close", tag: name });
      continue;
    }

    const equals = raw.indexOf("=");
    const name = (equals === -1 ? raw : raw.slice(0, equals)).trim().toLowerCase();
    if (!isTaggedTextTag(name)) {
      throw new TaggedTextError(
        `Unknown tag "<${name}>". Supported tags: ${TAGGED_TEXT_TAGS.join(", ")}.`
      );
    }

    flushText();

    if (name === "color") {
      if (equals === -1) {
        throw new TaggedTextError('Color tag requires a value, e.g. <color="red">.');
      }
      nodes.push({ kind: "open", tag: name, color: normalizeColor(raw.slice(equals + 1)) });
    } else {
      if (equals !== -1) {
        throw new TaggedTextError(`Tag "<${name}>" does not take a value.`);
      }
      nodes.push({ kind: "open", tag: name });
    }
    openStack.push(name);
  }

  flushText();

  if (openStack.length > 0) {
    throw new TaggedTextError(
      `Unclosed tag "<${openStack[openStack.length - 1]}>". Add a matching closing tag.`
    );
  }

  return nodes;
}

/** Plain text with all markup removed; used for length estimates in the editor. */
export function taggedTextToPlain(input: string): string {
  return parseTaggedText(input)
    .filter((node): node is Extract<TaggedTextNode, { kind: "text" }> => node.kind === "text")
    .map((node) => node.text)
    .join("");
}

export function validateTaggedText(input: string): string | null {
  try {
    parseTaggedText(input);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
