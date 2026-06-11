import { TreeCursor } from "@lezer/common";
import { normalizeFormatExpression } from "../modules/builtInModules";
import { parser } from "./museLabRazor.parser";
import {
  extractIfParts,
  extractCodeBlockBody,
  extractOutputExpr,
  extractOutputExprParen,
  splitStatements,
} from "./museLabRazorExtract";

const STATEMENT_PREFIX =
  /^\s*(?:rt\.(?:SetString|SetBool|SetInt|Emit|PlaySound|PlaySoundTrim|PlaySoundClip|PlaySoundClipByPath)|prompter\.(?:WaitInMs|RevealCharsBegin|RevealWordsBegin|RevealCharsOverTimeBegin|RevealWordsOverTimeBegin|RevealEnd|WaitForContinue|UpdateSpeaker))\s*\(/;

export type TemplateSurfaceSegment =
  | { kind: "literal"; value: string }
  | {
      kind: "expr";
      value: string;
      isStatement: boolean;
      isOutput: boolean;
      from: number;
      to: number;
    }
  | { kind: "if"; condition: string; body: TemplateSurfaceSegment[] };

export type TemplateFoldRange = {
  from: number;
  to: number;
  expr: string;
  isStatement: boolean;
};

export type TemplateExpressionRange = {
  from: number;
  to: number;
};

export class RazorTemplateParseError extends Error {
  readonly from?: number;
  readonly to?: number;

  constructor(message: string, from?: number, to?: number) {
    super(message);
    this.name = "RazorTemplateParseError";
    this.from = from;
    this.to = to;
  }
}

export function isStatementExpression(expr: string): boolean {
  return STATEMENT_PREFIX.test(expr.trim());
}

const DEFAULT_OUTPUT_ROOTS = ["rt", "format", "Format"] as const;

export function validateOutputExpression(
  expr: string,
  allowedRoots: readonly string[] = DEFAULT_OUTPUT_ROOTS,
  range?: { from: number; to: number },
): void {
  const trimmed = expr.trim();
  const rootMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\./);
  const from = range?.from;
  const to = range?.to;
  if (!rootMatch) {
    throw new RazorTemplateParseError(
      `Invalid @ expression "${trimmed}". Output expressions must call rt., format., Format., or a project module.`,
      from,
      to,
    );
  }
  const root = rootMatch[1]!;
  if (allowedRoots.includes(root)) return;

  if (/^[a-z]/.test(root)) {
    throw new RazorTemplateParseError(
      `Invalid @ expression "${trimmed}". Text like user@host.com is parsed as code — use @@ for a literal @ in text.`,
      from,
      to,
    );
  }

  throw new RazorTemplateParseError(
    `Invalid @ expression "${trimmed}". Unknown root "${root}".`,
    from,
    to,
  );
}

function validateTemplateSurfaceSegments(
  segments: TemplateSurfaceSegment[],
  allowedRoots: readonly string[],
): void {
  for (const segment of segments) {
    if (segment.kind === "expr" && segment.isOutput) {
      validateOutputExpression(segment.value, allowedRoots, {
        from: segment.from,
        to: segment.to,
      });
    }
    if (segment.kind === "if") {
      validateTemplateSurfaceSegments(segment.body, allowedRoots);
    }
  }
}

type ShakeMode = "none" | "chars" | "phrase";

function updateShakeMode(expr: string, mode: ShakeMode): ShakeMode {
  const trimmed = expr.trim();
  const normalized = normalizeFormatExpression(trimmed);
  if (normalized === "format.ShakeCharsStart()") return "chars";
  if (normalized === "format.ShakeCharsEnd()") return "none";
  if (normalized === "format.ShakePhraseStart()") return "phrase";
  if (normalized === "format.ShakePhraseEnd()") return "none";
  return mode;
}

function pushLiteral(segments: TemplateSurfaceSegment[], value: string): void {
  if (!value) return;
  segments.push({ kind: "literal", value });
}

function pushOutputExpr(
  segments: TemplateSurfaceSegment[],
  expr: string,
  shakeMode: ShakeMode,
  from: number,
  to: number,
): ShakeMode {
  const trimmed = expr.trim();
  if (!trimmed) return shakeMode;
  if (isStatementExpression(trimmed)) {
    throw new RazorTemplateParseError(
      `Side-effect expressions must use @{ ... }, not bare @: ${trimmed}`,
      from,
      to,
    );
  }
  const nextMode = updateShakeMode(trimmed, shakeMode);
  segments.push({
    kind: "expr",
    value: trimmed,
    isStatement: false,
    isOutput: true,
    from,
    to,
  });
  return nextMode;
}

function pushStatementExpr(
  segments: TemplateSurfaceSegment[],
  expr: string,
  shakeMode: ShakeMode,
  from: number,
  to: number,
): ShakeMode {
  const trimmed = expr.trim();
  if (!trimmed) return shakeMode;
  const nextMode = updateShakeMode(trimmed, shakeMode);
  segments.push({
    kind: "expr",
    value: trimmed,
    isStatement: true,
    isOutput: false,
    from,
    to,
  });
  return nextMode;
}

function walkItem(
  source: string,
  cursor: TreeCursor,
  shakeMode: ShakeMode
): [TemplateSurfaceSegment[], ShakeMode] {
  const segments: TemplateSurfaceSegment[] = [];
  const node = cursor.node;
  const text = source.slice(node.from, node.to);

  switch (node.type.name) {
    case "Text":
      pushLiteral(segments, text);
      break;
    case "EscapedAt":
      pushLiteral(segments, "@");
      break;
    case "OutputExpr":
      shakeMode = pushOutputExpr(segments, extractOutputExpr(text), shakeMode, node.from, node.to);
      break;
    case "OutputExprParen":
      shakeMode = pushOutputExpr(
        segments,
        extractOutputExprParen(text),
        shakeMode,
        node.from,
        node.to,
      );
      break;
    case "CodeBlock": {
      const body = extractCodeBlockBody(text);
      for (const statement of splitStatements(body)) {
        shakeMode = pushStatementExpr(segments, statement, shakeMode, node.from, node.to);
      }
      break;
    }
    case "IfBlock": {
      const { condition, body } = extractIfParts(text);
      const [bodySegments, nextMode] = parseRazorTemplateInner(body, shakeMode);
      shakeMode = nextMode;
      segments.push({
        kind: "if",
        condition: condition.trim(),
        body: bodySegments,
      });
      break;
    }
    default:
      break;
  }

  return [segments, shakeMode];
}

function parseRazorTemplateInner(
  template: string,
  shakeMode: ShakeMode
): [TemplateSurfaceSegment[], ShakeMode] {
  const tree = parser.parse(template);
  const cursor = tree.cursor();
  const segments: TemplateSurfaceSegment[] = [];

  if (!cursor.firstChild()) {
    return [segments, shakeMode];
  }

  do {
    const [itemSegments, nextMode] = walkItem(template, cursor, shakeMode);
    segments.push(...itemSegments);
    shakeMode = nextMode;
  } while (cursor.nextSibling());

  return [segments, shakeMode];
}

export function parseRazorTemplate(
  template: string,
  shakeMode: ShakeMode = "none"
): TemplateSurfaceSegment[] {
  return parseRazorTemplateInner(template, shakeMode)[0];
}

export function parseTemplateSurface(
  template: string,
  shakeMode: ShakeMode = "none"
): TemplateSurfaceSegment[] {
  return parseRazorTemplate(template, shakeMode);
}

const CODE_NODE_NAMES = new Set([
  "OutputExpr",
  "OutputExprParen",
  "CodeBlock",
  "IfBlock",
]);

export function collectRazorCodeRanges(template: string): TemplateExpressionRange[] {
  const ranges: TemplateExpressionRange[] = [];
  const tree = parser.parse(template);
  tree.iterate({
    enter(node) {
      if (CODE_NODE_NAMES.has(node.type.name)) {
        ranges.push({ from: node.from, to: node.to });
      }
    },
  });
  return ranges;
}

/** @deprecated Use collectRazorCodeRanges */
export function collectTemplateExpressionRanges(template: string): TemplateExpressionRange[] {
  return collectRazorCodeRanges(template);
}

export function isInsideTemplateExpression(
  position: number,
  ranges: TemplateExpressionRange[]
): boolean {
  return ranges.some((range) => position >= range.from && position < range.to);
}

export function collectTemplateFoldRanges(template: string): TemplateFoldRange[] {
  const ranges: TemplateFoldRange[] = [];
  const tree = parser.parse(template);
  tree.iterate({
    enter(node) {
      const text = template.slice(node.from, node.to);
      if (node.type.name === "OutputExpr") {
        const expr = extractOutputExpr(text).trim();
        if (expr) {
          ranges.push({
            from: node.from,
            to: node.to,
            expr,
            isStatement: false,
          });
        }
        return;
      }
      if (node.type.name === "OutputExprParen") {
        const expr = extractOutputExprParen(text).trim();
        if (expr) {
          ranges.push({
            from: node.from,
            to: node.to,
            expr,
            isStatement: false,
          });
        }
        return;
      }
      if (node.type.name === "CodeBlock") {
        const body = extractCodeBlockBody(text);
        for (const statement of splitStatements(body)) {
          const trimmed = statement.trim();
          if (!trimmed) continue;
          ranges.push({
            from: node.from,
            to: node.to,
            expr: trimmed,
            isStatement: true,
          });
        }
      }
    },
  });
  return ranges;
}

export function validateRazorTemplate(
  template: string,
  allowedOutputRoots: readonly string[] = DEFAULT_OUTPUT_ROOTS,
): void {
  const segments = parseRazorTemplate(template);
  validateTemplateSurfaceSegments(segments, allowedOutputRoots);
}
