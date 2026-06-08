import type { Project, ServiceInterface, CitoType } from "@/core/model/types";
import {
  createHtmlPromptRenderer,
  createPromptRendererBridge,
  type PromptRenderer,
  type HtmlPromptRendererOptions,
} from "./htmlPromptRenderer";
import { createFormatMarkerBridge } from "./formatMarkerRuntime";
import { createMuseLabRuntimeBridge, type TemplateContext } from "@/core/cito/runtimeBridge";

function defaultReturnValue(type: CitoType): unknown {
  switch (type) {
    case "void":
      return undefined;
    case "string":
      return "";
    case "bool":
      return false;
    case "int":
      return 0;
    case "double":
      return 0;
    default:
      return null;
  }
}

function toCamelCase(name: string): string {
  if (!name) return name;
  return name[0].toLowerCase() + name.slice(1);
}

export function createNullStubService(service: ServiceInterface): Record<string, (...args: unknown[]) => unknown> {
  const stub: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of service.methods) {
    const key = toCamelCase(method.name);
    if (method.returnType === "void") {
      stub[key] = () => undefined;
    } else {
      const value = defaultReturnValue(method.returnType);
      stub[key] = () => value;
    }
    stub[method.name] = stub[key];
  }
  return stub;
}

function compileTypescriptService(
  service: ServiceInterface,
  source: string
): Record<string, (...args: unknown[]) => unknown> {
  const className = service.name.startsWith("I") ? service.name.slice(1) : service.name;
  const fn = new Function(
    `
    ${source}
    if (typeof ${className} === "function") {
      return new ${className}();
    }
    if (typeof ${className} === "object" && ${className} !== null) {
      return ${className};
    }
    if (typeof service === "object" && service !== null) {
      return service;
    }
    throw new Error("Service implementation must define ${className} or service");
  `
  ) as () => Record<string, (...args: unknown[]) => unknown>;

  return fn();
}

export function createCustomServiceInstance(
  service: ServiceInterface
): Record<string, (...args: unknown[]) => unknown> {
  if (service.typescriptSource?.trim()) {
    try {
      return compileTypescriptService(service, service.typescriptSource);
    } catch (error) {
      console.warn(`Service ${service.name} TS implementation failed, using null stub:`, error);
    }
  }
  return createNullStubService(service);
}

export function createPromptRenderer(
  project: Project,
  options: HtmlPromptRendererOptions = {}
): PromptRenderer {
  if (project.promptRendererTypescriptSource?.trim()) {
    try {
      const custom = compileTypescriptService(
        {
          id: "builtin:prompter",
          name: "IMuseLabPromptRenderer",
          bindingName: "prompter",
          methods: [],
        },
        project.promptRendererTypescriptSource
      );
      if (
        typeof custom.addLiteral === "function" &&
        typeof custom.appendResult === "function" &&
        typeof custom.applyFormat === "function" &&
        typeof custom.render === "function"
      ) {
        return {
          addLiteral: (text) => custom.addLiteral(text),
          appendResult: (value) => custom.appendResult(value),
          applyFormat: (marker) => custom.applyFormat(marker),
          render: () => String(custom.render()),
        };
      }
      if (
        typeof custom.AddLiteral === "function" &&
        typeof custom.AppendResult === "function" &&
        typeof custom.ApplyFormat === "function" &&
        typeof custom.Render === "function"
      ) {
        return {
          addLiteral: (text) => custom.AddLiteral(text),
          appendResult: (value) => custom.AppendResult(value),
          applyFormat: (marker) => custom.ApplyFormat(marker),
          render: () => String(custom.Render()),
        };
      }
      throw new Error("Prompt renderer must implement addLiteral, appendResult, applyFormat, render");
    } catch (error) {
      console.warn("Custom prompt renderer failed, using default HTML renderer:", error);
    }
  }
  return createHtmlPromptRenderer(options);
}

export type ServiceBindings = Record<string, unknown> & {
  rt: ReturnType<typeof createMuseLabRuntimeBridge>;
  prompter: ReturnType<typeof createPromptRendererBridge>;
  format: ReturnType<typeof createFormatMarkerBridge>;
};

export function createServiceBindings(
  project: Project,
  context: TemplateContext,
  options: HtmlPromptRendererOptions = {}
): ServiceBindings {
  const renderer = createPromptRenderer(project, options);
  const bindings: ServiceBindings = {
    rt: createMuseLabRuntimeBridge(context),
    prompter: createPromptRendererBridge(renderer),
    format: createFormatMarkerBridge(),
  };

  for (const service of project.services) {
    bindings[service.bindingName] = createCustomServiceInstance(service);
  }

  return bindings;
}
