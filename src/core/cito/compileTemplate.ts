import type { Project } from "../model/types";
import { hashId } from "./hashId";
import { buildCiPreamble, buildRenderParameterList } from "../modules/generateModuleCi";
import { isFormatExpression, normalizeFormatExpression } from "../modules/builtInModules";
import {
  parseTemplateSurface,
  type TemplateSurfaceSegment,
} from "./parseTemplateSurface";

type Segment = TemplateSurfaceSegment;

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
      if (segment.isOutput || !segment.isStatement) {
        lines.push(emitExprStatement(segment.value));
      } else {
        lines.push(`${normalizeFormatExpression(segment.value)};`);
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
  const segments = parseTemplateSurface(template);
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
  return ["rt", "prompter", "format", ...project.modules.map((service) => service.bindingName)];
}
