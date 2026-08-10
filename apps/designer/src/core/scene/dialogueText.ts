import type { Project } from "../model/types";
import { escapeCiString } from "../cito/escapeCiString";
import {
  parseTemplateSurface,
  validateRazorTemplate,
  type TemplateSurfaceSegment,
} from "../cito/parseTemplateSurface";
import { isFormatExpression, normalizeFormatExpression } from "../modules/builtInModules";
import { getOutputExpressionRoots } from "../cito/compileTemplate";
import { parseTaggedText, validateTaggedText, type TaggedTextNode } from "./taggedText";

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

function validateTaggedLiterals(segments: TemplateSurfaceSegment[]): string | null {
  for (const segment of segments) {
    if (segment.kind === "literal") {
      const issue = validateTaggedText(segment.value);
      if (issue) return issue;
      continue;
    }
    if (segment.kind === "if") {
      const issue = validateTaggedLiterals(segment.body);
      if (issue) return issue;
    }
  }
  return null;
}

/** Validate Razor structure and tagged markup inside literal runs. */
export function validateDialogueText(text: string, project?: Project): string | null {
  if (!text) return null;
  try {
    const roots = project ? getOutputExpressionRoots(project) : undefined;
    validateRazorTemplate(text, roots);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return validateTaggedLiterals(parseTemplateSurface(text));
}
