import type { Project, ModuleInterface, CitoType } from "@/core/model/types";
import { citoTypeDefaultValue } from "@/core/model/project";
import {
  museLabRuntimeCi,
  museLabFormatCi,
  iFormatMarkerCi,
  museLabPromptRendererCi,
} from "@/cito/ciSources";
import { citoTypeToString } from "./builtInModules";

function methodSignature(method: ModuleInterface["methods"][number]): string {
  const params = method.parameters
    .map((param) => `${citoTypeToString(param.type)} ${param.name}`)
    .join(", ");
  const returnType = citoTypeToString(method.returnType);
  if (returnType === "void") {
    return `public void ${method.name}(${params})`;
  }
  return `public ${returnType} ${method.name}(${params})`;
}

function methodBody(method: ModuleInterface["methods"][number]): string {
  const returnType = method.returnType;
  if (returnType === "void") {
    return "";
  }
  return `return ${citoTypeDefaultValue(returnType)};`;
}

export function generateModuleCiStub(service: ModuleInterface): string {
  const className = service.name.startsWith("I")
    ? service.name.slice(1)
    : service.name;

  const methods = service.methods
    .map((method) => {
      const body = methodBody(method);
      return body
        ? `    ${methodSignature(method)}\n    {\n        ${body}\n    }`
        : `    ${methodSignature(method)}\n    {\n    }`;
    })
    .join("\n\n");

  return `public class ${className}\n{\n${methods}\n}`;
}

export function buildRenderParameterList(project: Project): string {
  const customParams = project.modules.map(
    (service) => {
      const className = service.name.startsWith("I")
        ? service.name.slice(1)
        : service.name;
      return `${className} ${service.bindingName}`;
    }
  );
  return [
    "MuseLabRuntime rt",
    "MuseLabPromptRenderer prompter",
    "MuseLabFormat format",
    ...customParams,
  ].join(", ");
}

export function buildCiPreamble(project: Project): string {
  const customStubs = project.modules.map(generateModuleCiStub).join("\n\n");
  const parts = [
    museLabRuntimeCi.trim(),
    iFormatMarkerCi.trim(),
    museLabFormatCi.trim(),
    museLabPromptRendererCi.trim(),
    customStubs.trim(),
  ].filter(Boolean);
  return `${parts.join("\n\n")}\n`;
}

export function defaultValueForCitoType(type: CitoType): string {
  return citoTypeDefaultValue(type);
}
