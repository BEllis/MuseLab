import type { Project, ModuleInterface, CitoType } from "@/core/model/types";
import {
  createHtmlPromptRenderer,
  createPromptRendererBridge,
  type PromptRenderer,
  type HtmlPromptRendererOptions,
} from "./htmlPromptRenderer";
import { createFormatMarkerBridge } from "./formatMarkerRuntime";
import { createMuseLabRuntimeBridge, type TemplateContext } from "@/core/cito/runtimeBridge";
import { createPromptInstructionRecorder } from "@/core/prompt/promptInstructions";

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

export function createNullStubModule(service: ModuleInterface): Record<string, (...args: unknown[]) => unknown> {
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

function compileTypescriptModule(
  service: ModuleInterface,
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
    throw new Error("Module implementation must define ${className} or module");
  `
  ) as () => Record<string, (...args: unknown[]) => unknown>;

  return fn();
}

export function createCustomModuleInstance(
  service: ModuleInterface
): Record<string, (...args: unknown[]) => unknown> {
  if (service.typescriptSource?.trim()) {
    try {
      return compileTypescriptModule(service, service.typescriptSource);
    } catch (error) {
      console.warn(`Module ${service.name} TS implementation failed, using null stub:`, error);
    }
  }
  return createNullStubModule(service);
}

const noopTimingMethods = {
  wait: () => undefined,
  revealCharsBegin: () => undefined,
  revealWordsBegin: () => undefined,
  revealCharsOverTimeBegin: () => undefined,
  revealWordsOverTimeBegin: () => undefined,
  revealEnd: () => undefined,
  waitForContinue: () => undefined,
  updateSpeaker: () => undefined,
  reset: () => undefined,
  clear: () => undefined,
};

export function createPromptRenderer(
  project: Project,
  options: HtmlPromptRendererOptions = {}
): PromptRenderer {
  if (project.promptRendererTypescriptSource?.trim()) {
    try {
      const custom = compileTypescriptModule(
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
          getInstructions: () => [],
          ...noopTimingMethods,
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
          getInstructions: () => [],
          ...noopTimingMethods,
        };
      }
      throw new Error("Prompt renderer must implement addLiteral, appendResult, applyFormat, render");
    } catch (error) {
      console.warn("Custom prompt renderer failed, using default HTML renderer:", error);
    }
  }
  return createHtmlPromptRenderer({ ...options, project });
}

export type ModuleBindings = Record<string, unknown> & {
  rt: ReturnType<typeof createMuseLabRuntimeBridge>;
  prompter: ReturnType<typeof createPromptRendererBridge>;
  format: ReturnType<typeof createFormatMarkerBridge>;
  promptRenderer: PromptRenderer;
};

export function createModuleBindings(
  project: Project,
  context: TemplateContext,
  options: HtmlPromptRendererOptions = {}
): ModuleBindings {
  const recorder = createPromptInstructionRecorder();
  const renderer = createPromptRenderer(project, { ...options, recorder });
  const bindings: ModuleBindings = {
    rt: createMuseLabRuntimeBridge({
      ...context,
      project,
      instructionRecorder: recorder,
    }),
    prompter: createPromptRendererBridge(renderer),
    format: createFormatMarkerBridge(),
    promptRenderer: renderer,
  };

  for (const service of project.modules) {
    bindings[service.bindingName] = createCustomModuleInstance(service);
  }

  return bindings;
}
