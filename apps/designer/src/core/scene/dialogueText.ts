import type { Project } from "../model/types";
import { escapeCiString } from "../cito/escapeCiString";
import {
  parseTemplateSurface,
  RazorTemplateParseError,
  validateRazorTemplate,
  type TemplateSurfaceSegment,
} from "../cito/parseTemplateSurface";
import { isFormatExpression, normalizeFormatExpression } from "../modules/builtInModules";
import { getOutputExpressionRoots } from "../cito/compileTemplate";
import {
  normalizeColor,
  parseTaggedText,
  TAGGED_TEXT_TAGS,
  type TaggedTextNode,
  type TaggedTextTag,
} from "./taggedText";

export type DialogueTextIssue = {
  message: string;
  from?: number;
  to?: number;
};

const SPAN_HINT =
  "Markup tags (<b>, <i>, …) must stay balanced inside one text run — they cannot wrap @rt / @if. Close the tag before the expression, put the whole tagged phrase in each @if branch, or use @Format.BoldStart() / @Format.BoldEnd().";

function openFormatCall(node: Extract<TaggedTextNode, { kind: "open" }>): string {
  switch (node.tag) {
    case "b":
      return "format.BoldStart()";
    case "i":
      return "format.ItalicStart()";
    case "u":
      return "format.UnderlineStart()";
    case "shake":
      return "format.ShakePhraseStart()";
    case "color":
      return `format.ColorStart("${escapeCiString(node.color ?? "#ffffff")}")`;
  }
}

function closeFormatCall(node: Extract<TaggedTextNode, { kind: "close" }>): string {
  switch (node.tag) {
    case "b":
      return "format.BoldEnd()";
    case "i":
      return "format.ItalicEnd()";
    case "u":
      return "format.UnderlineEnd()";
    case "shake":
      return "format.ShakePhraseEnd()";
    case "color":
      return "format.ColorEnd()";
  }
}

/** Lower a single tagged-markup run into prompter calls. */
export function emitTaggedText(text: string, lines: string[]): void {
  for (const node of parseTaggedText(text)) {
    if (node.kind === "text") {
      if (node.text) lines.push(`prompter.AddLiteral("${escapeCiString(node.text)}");`);
      continue;
    }
    if (node.kind === "open") {
      lines.push(`prompter.ApplyFormat(${openFormatCall(node)});`);
      continue;
    }
    lines.push(`prompter.ApplyFormat(${closeFormatCall(node)});`);
  }
}

function emitExprStatement(expr: string): string {
  const normalized = normalizeFormatExpression(expr);
  if (isFormatExpression(expr)) {
    return `prompter.ApplyFormat(${normalized});`;
  }
  return `prompter.AppendResult((${normalized}));`;
}

function emitDialogueSegments(segments: TemplateSurfaceSegment[], lines: string[]): void {
  for (const segment of segments) {
    if (segment.kind === "literal") {
      if (segment.value) emitTaggedText(segment.value, lines);
      continue;
    }
    if (segment.kind === "expr") {
      if (segment.isOutput || !segment.isStatement) {
        lines.push(emitExprStatement(segment.value));
      } else {
        lines.push(`${normalizeFormatExpression(segment.value)};`);
      }
      continue;
    }
    lines.push(`if (${normalizeFormatExpression(segment.condition)}) {`);
    emitDialogueSegments(segment.body, lines);
    lines.push("}");
  }
}

/**
 * Compile dialogue / speaker text.
 *
 * Razor (`@rt…`, `@if`, `@Format…`) is the outer surface. Tagged markup
 * (`<b>`, `<i>`, `<u>`, `<shake>`, `<color=…>`) is lowered inside each literal run.
 */
export function emitDialogueText(text: string, lines: string[], project?: Project): void {
  if (!text) return;
  const roots = project ? getOutputExpressionRoots(project) : undefined;
  validateRazorTemplate(text, roots);
  emitDialogueSegments(parseTemplateSurface(text), lines);
}

type MarkupScan = {
  /** Tags still open after scanning this literal. */
  openStack: TaggedTextTag[];
  issues: string[];
};

/**
 * Scan markup in a literal run without requiring the stack to end empty.
 * Used so we can detect tags that continue across a following @ expression.
 */
function scanTaggedMarkup(input: string, startingStack: TaggedTextTag[] = []): MarkupScan {
  const openStack = [...startingStack];
  const issues: string[] = [];
  let index = 0;

  const isTag = (value: string): value is TaggedTextTag =>
    (TAGGED_TEXT_TAGS as readonly string[]).includes(value);

  while (index < input.length) {
    if (input[index] !== "<") {
      index += 1;
      continue;
    }

    const end = input.indexOf(">", index);
    if (end === -1) {
      issues.push(
        `Unclosed markup tag starting at position ${index}. Escape a literal "<" as "&lt;".`
      );
      break;
    }

    const raw = input.slice(index + 1, end).trim();
    index = end + 1;

    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().toLowerCase();
      if (!isTag(name)) {
        issues.push(
          `Unknown closing tag "</${name}>". Supported tags: ${TAGGED_TEXT_TAGS.join(", ")}.`
        );
        continue;
      }
      const expected = openStack.pop();
      if (expected === undefined) {
        issues.push(`Closing tag "</${name}>" has no matching opening tag.`);
        continue;
      }
      if (expected !== name) {
        issues.push(
          `Closing tag "</${name}>" does not match the currently open "<${expected}>".`
        );
        openStack.push(expected);
      }
      continue;
    }

    const equals = raw.indexOf("=");
    const name = (equals === -1 ? raw : raw.slice(0, equals)).trim().toLowerCase();
    if (!isTag(name)) {
      issues.push(`Unknown tag "<${name}>". Supported tags: ${TAGGED_TEXT_TAGS.join(", ")}.`);
      continue;
    }
    if (name === "color" && equals === -1) {
      issues.push('Color tag requires a value, e.g. <color="red">.');
      continue;
    }
    if (name !== "color" && equals !== -1) {
      issues.push(`Tag "<${name}>" does not take a value.`);
      continue;
    }
    if (name === "color" && equals !== -1) {
      try {
        normalizeColor(raw.slice(equals + 1));
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
        continue;
      }
    }
    openStack.push(name);
  }

  return { openStack, issues };
}

function pushSpanIssue(issues: DialogueTextIssue[], openTag: TaggedTextTag, context: string): void {
  issues.push({
    message: `Open markup tag "<${openTag}>" crosses ${context}. ${SPAN_HINT}`,
  });
}

function validateDialogueSegments(
  segments: TemplateSurfaceSegment[],
  issues: DialogueTextIssue[],
  openStack: TaggedTextTag[]
): TaggedTextTag[] {
  let stack = [...openStack];

  for (const segment of segments) {
    if (segment.kind === "literal") {
      if (!segment.value) continue;
      const scanned = scanTaggedMarkup(segment.value, stack);
      for (const message of scanned.issues) {
        issues.push({ message });
      }
      stack = scanned.openStack;
      continue;
    }

    if (segment.kind === "expr") {
      // @Format.* intentionally opens/closes markup across the Razor surface.
      if (isFormatExpression(segment.value)) continue;
      if (stack.length > 0) {
        pushSpanIssue(issues, stack[stack.length - 1], "an @ expression");
      }
      continue;
    }

    // @if (…) { … }
    if (stack.length > 0) {
      pushSpanIssue(issues, stack[stack.length - 1], "an @if block");
    }
    const bodyStack = validateDialogueSegments(segment.body, issues, []);
    if (bodyStack.length > 0) {
      issues.push({
        message: `Unclosed markup tag "<${bodyStack[bodyStack.length - 1]}>" inside @if. ${SPAN_HINT}`,
      });
    }
  }

  return stack;
}

/**
 * Validate Razor structure and tagged-markup rules for dialogue / speaker text.
 * Returns every issue found so the editor can list them under the action.
 */
export function validateDialogueTextIssues(
  text: string,
  project?: Project
): DialogueTextIssue[] {
  if (!text) return [];
  const issues: DialogueTextIssue[] = [];

  try {
    const roots = project ? getOutputExpressionRoots(project) : undefined;
    validateRazorTemplate(text, roots);
  } catch (error) {
    if (error instanceof RazorTemplateParseError) {
      issues.push({
        message: `Razor: ${error.message}`,
        from: error.from,
        to: error.to,
      });
    } else {
      issues.push({
        message: `Razor: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    // Still attempt markup checks on a best-effort parse when Razor failed hard.
    return issues;
  }

  const stack = validateDialogueSegments(parseTemplateSurface(text), issues, []);
  if (stack.length > 0) {
    issues.push({
      message: `Unclosed markup tag "<${stack[stack.length - 1]}>". ${SPAN_HINT}`,
    });
  }

  return issues;
}

/** Validate Razor structure and tagged markup; returns the first issue message. */
export function validateDialogueText(text: string, project?: Project): string | null {
  return validateDialogueTextIssues(text, project)[0]?.message ?? null;
}
