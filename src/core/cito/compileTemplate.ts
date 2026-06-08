import type { Project } from "../model/types";
import { hashId } from "./hashId";
import { buildCiPreamble, buildRenderParameterList } from "../services/generateServiceCi";
import { isFormatExpression, normalizeFormatExpression } from "../services/builtInServices";

const IF_REGEX = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
const EXPR_REGEX = /\{\{([^}]*)\}\}/g;

const STATEMENT_PREFIX =
  /^\s*rt\.(?:SetString|SetBool|SetInt|Emit|PlaySound|PlaySoundTrim)\s*\(/;

type ShakeMode = "none" | "chars" | "phrase";

type Segment =
  | { kind: "literal"; value: string }
  | { kind: "expr"; value: string; isStatement: boolean }
  | { kind: "if"; condition: string; body: Segment[] };

export type CompiledTemplate = {
  className: string;
  ciSource: string;
};

function escapeCiString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function isStatementExpression(expr: string): boolean {
  return STATEMENT_PREFIX.test(expr.trim());
}

function updateShakeMode(expr: string, mode: ShakeMode): ShakeMode {
  const trimmed = expr.trim();
  const normalized = normalizeFormatExpression(trimmed);
  if (normalized === "format.ShakeCharsStart()") return "chars";
  if (normalized === "format.ShakeCharsEnd()") return "none";
  if (normalized === "format.ShakePhraseStart()") return "phrase";
  if (normalized === "format.ShakePhraseEnd()") return "none";
  return mode;
}

function literalSegment(value: string, _shakeMode: ShakeMode): Segment {
  if (!value) {
    return { kind: "literal", value: "" };
  }
  return { kind: "literal", value };
}

function parseSegments(template: string, shakeMode: ShakeMode = "none"): Segment[] {
  const segments: Segment[] = [];
  let index = 0;

  while (index < template.length) {
    IF_REGEX.lastIndex = index;
    EXPR_REGEX.lastIndex = index;
    const ifMatch = IF_REGEX.exec(template);
    const exprMatch = EXPR_REGEX.exec(template);

    let next:
      | { type: "if"; match: RegExpExecArray }
      | { type: "expr"; match: RegExpExecArray }
      | null = null;

    if (ifMatch && exprMatch) {
      next =
        ifMatch.index <= exprMatch.index
          ? { type: "if", match: ifMatch }
          : { type: "expr", match: exprMatch };
    } else if (ifMatch) {
      next = { type: "if", match: ifMatch };
    } else if (exprMatch) {
      next = { type: "expr", match: exprMatch };
    }

    if (!next) {
      segments.push(literalSegment(template.slice(index), shakeMode));
      break;
    }

    if (next.match.index > index) {
      segments.push(literalSegment(template.slice(index, next.match.index), shakeMode));
    }

    if (next.type === "if") {
      segments.push({
        kind: "if",
        condition: next.match[1].trim(),
        body: parseSegments(next.match[2], shakeMode),
      });
      index = next.match.index + next.match[0].length;
      continue;
    }

    const expr = next.match[1].trim();
    if (expr) {
      shakeMode = updateShakeMode(expr, shakeMode);
      segments.push({
        kind: "expr",
        value: expr,
        isStatement: isStatementExpression(expr),
      });
    }
    index = next.match.index + next.match[0].length;
  }

  return segments;
}

function emitExprStatement(expr: string): string {
  const normalized = normalizeFormatExpression(expr);
  if (isFormatExpression(expr)) {
    return `prompter.ApplyFormat(${normalized});`;
  }
  return `prompter.AppendResult((${normalized}));`;
}

function segmentsToPrompterLines(segments: Segment[], lines: string[]): void {
  for (const segment of segments) {
    if (segment.kind === "literal") {
      if (segment.value) {
        lines.push(`prompter.AddLiteral("${escapeCiString(segment.value)}");`);
      }
      continue;
    }
    if (segment.kind === "expr") {
      if (segment.isStatement) {
        lines.push(`${normalizeFormatExpression(segment.value)};`);
      } else {
        lines.push(emitExprStatement(segment.value));
      }
      continue;
    }
    lines.push(`if (${normalizeFormatExpression(segment.condition)}) {`);
    segmentsToPrompterLines(segment.body, lines);
    lines.push("}");
  }
}

function buildRenderMethod(segments: Segment[]): string {
  const lines: string[] = [];
  segmentsToPrompterLines(segments, lines);
  lines.push("return prompter.Render();");
  return lines.join("\n        ");
}

export function compileTemplate(template: string, project: Project): CompiledTemplate {
  const segments = parseSegments(template);
  const className = hashId(template, "Template");
  const renderBody = buildRenderMethod(segments);
  const params = buildRenderParameterList(project);
  const generated = `
public static class ${className}
{
    public static string Render(${params})
    {
        ${renderBody}
    }
}
`;

  return {
    className,
    ciSource: `${buildCiPreamble(project)}${generated.trim()}\n`,
  };
}

export function getTemplateBindingNames(project: Project): string[] {
  return ["rt", "prompter", "format", ...project.services.map((service) => service.bindingName)];
}
