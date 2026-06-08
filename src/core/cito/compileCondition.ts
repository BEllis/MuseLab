import type { Project } from "../model/types";
import { hashId } from "./hashId";
import { buildCiPreamble, buildRenderParameterList } from "../services/generateServiceCi";
import { normalizeFormatExpression } from "../services/builtInServices";

export type CompiledCondition = {
  className: string;
  ciSource: string;
};

export function compileCondition(condition: string, project: Project): CompiledCondition {
  const trimmed = condition.trim();
  const className = hashId(trimmed, "Condition");
  const params = buildRenderParameterList(project);
  const generated = `
public static class ${className}
{
    public static bool Eval(${params})
    {
        return ${normalizeFormatExpression(trimmed)};
    }
}
`;

  return {
    className,
    ciSource: `${buildCiPreamble(project)}${generated.trim()}\n`,
  };
}

export function getConditionBindingNames(project: Project): string[] {
  return ["rt", "prompter", "format", ...project.services.map((service) => service.bindingName)];
}
