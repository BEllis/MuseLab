import type { Completion, CompletionContext } from "@codemirror/autocomplete";
import type { Project } from "@/core/model/types";
import type { ModuleMethod } from "@/core/model/types";
import { BUILT_IN_MODULES } from "@/core/modules/builtInModules";
import { citoTypeToString } from "@/core/modules/builtInModules";

export type TemplateCompletionModule = {
  bindingName: string;
  displayName: string;
  methods: ModuleMethod[];
};

export function buildTemplateCompletionModules(project: Project): TemplateCompletionModule[] {
  const builtIns = BUILT_IN_MODULES.map((module) => ({
    bindingName: module.bindingName,
    displayName: module.name,
    methods: module.methods,
  }));

  const formatAlias: TemplateCompletionModule = {
    bindingName: "Format",
    displayName: "Format (alias)",
    methods: builtIns.find((m) => m.bindingName === "format")?.methods ?? [],
  };

  const custom = project.modules.map((module) => ({
    bindingName: module.bindingName,
    displayName: module.name,
    methods: module.methods,
  }));

  return [...builtIns, formatAlias, ...custom];
}

function methodSignature(method: ModuleMethod): string {
  const params = method.parameters
    .map((param) => `${param.name}: ${citoTypeToString(param.type)}`)
    .join(", ");
  return `${method.name}(${params}): ${citoTypeToString(method.returnType)}`;
}

function methodCompletions(module: TemplateCompletionModule): Completion[] {
  return module.methods.map((method) => ({
    label: method.name,
    type: method.returnType === "void" ? "function" : "method",
    detail: methodSignature(method),
    apply: `${method.name}(`,
  }));
}

function bindingCompletions(modules: TemplateCompletionModule[]): Completion[] {
  const seen = new Set<string>();
  const items: Completion[] = [];
  for (const module of modules) {
    if (seen.has(module.bindingName)) continue;
    seen.add(module.bindingName);
    items.push({
      label: module.bindingName,
      type: "namespace",
      detail: module.displayName,
      apply: module.bindingName === "Format" ? "Format." : `${module.bindingName}.`,
    });
  }
  return items;
}

export function templateCompletionSource(modules: TemplateCompletionModule[]) {
  return (context: CompletionContext): { from: number; options: Completion[] } | null => {
    const before = context.matchBefore(/[\w.]*$/);
    if (!before && !context.explicit) return null;

    const token = before?.text ?? "";
    const from = before ? before.from : context.pos;

    const dotIndex = token.lastIndexOf(".");
    if (dotIndex >= 0) {
      const binding = token.slice(0, dotIndex);
      const module =
        modules.find((entry) => entry.bindingName === binding) ??
        (binding === "Format" ? modules.find((entry) => entry.bindingName === "format") : undefined);
      if (!module) return null;
      return { from, options: methodCompletions(module) };
    }

    return { from, options: bindingCompletions(modules) };
  };
}
