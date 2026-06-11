import type { Project } from "../model/types";
import { hashId } from "./hashId";
import {
  buildCiPreamble,
  buildExportRenderParameterList,
  buildRenderParameterList,
} from "../modules/generateModuleCi";
import { normalizeFormatExpression } from "../modules/builtInModules";

export type CompiledCondition = {
  className: string;
  ciSource: string;
};

export type CompileConditionOptions = {
  forExport?: boolean;
  includePreamble?: boolean;
};

export function compileCondition(
  condition: string,
  project: Project,
  options?: CompileConditionOptions
): CompiledCondition {
  const trimmed = condition.trim();
  const className = hashId(trimmed, "Condition");
  const params = options?.forExport
    ? buildExportRenderParameterList(project)
    : buildRenderParameterList(project);
  const classSource = `public static class ${className}
{
    public static bool Eval(${params})
    {
        return ${normalizeFormatExpression(trimmed)};
    }
}`;
  const includePreamble = options?.includePreamble !== false;
  const preamble = options?.forExport ? "" : buildCiPreamble(project);
  return {
    className,
    ciSource: includePreamble ? `${preamble}${classSource}\n` : `${classSource}\n`,
  };
}

export function getConditionBindingNames(project: Project): string[] {
  return ["rt", "prompter", "format", ...project.modules.map((service) => service.bindingName)];
}
