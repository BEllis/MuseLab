import type { Project } from "../model/types";
import { hashId } from "./hashId";
import {
  buildCiPreamble,
  buildExportRenderParameterList,
  buildRenderParameterList,
} from "../modules/generateModuleCi";
import { isFormatExpression, normalizeFormatExpression } from "../modules/builtInModules";
import {
  parseTemplateSurface,
  validateRazorTemplate,
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

export function getOutputExpressionRoots(project: Project): string[] {
  return ["rt", "format", "Format", ...project.modules.map((service) => service.bindingName)];
}

export type CompileTemplateOptions = {
  forExport?: boolean;
  includePreamble?: boolean;
};

function buildTemplateClass(
  template: string,
  project: Project,
  options?: CompileTemplateOptions
): { className: string; classSource: string } {
  validateRazorTemplate(template, getOutputExpressionRoots(project));
  const segments = parseTemplateSurface(template);
  const className = hashId(template, "Template");
  const renderBody = buildRenderMethod(segments);
  const params = options?.forExport
    ? buildExportRenderParameterList(project)
    : buildRenderParameterList(project);
  const classSource = `public static class ${className}
{
    public static string Render(${params})
    {
        ${renderBody}
    }
}`;
  return { className, classSource };
}

export function compileTemplate(
  template: string,
  project: Project,
  options?: CompileTemplateOptions
): CompiledTemplate {
  const { className, classSource } = buildTemplateClass(template, project, options);
  const includePreamble = options?.includePreamble !== false;
  const preamble = options?.forExport ? "" : buildCiPreamble(project);
  return {
    className,
    ciSource: includePreamble ? `${preamble}${classSource}\n` : `${classSource}\n`,
  };
}

export function getTemplateBindingNames(project: Project): string[] {
  return ["rt", "prompter", "format", ...project.modules.map((service) => service.bindingName)];
}
