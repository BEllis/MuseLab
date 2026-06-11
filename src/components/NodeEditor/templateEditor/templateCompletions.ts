import type { Completion, CompletionContext } from "@codemirror/autocomplete";
import type { Project } from "@/core/model/types";
import type { ModuleMethod } from "@/core/model/types";
import {
  collectRazorCodeRanges,
  isInsideTemplateExpression,
} from "@/core/cito/parseRazorTemplate";
import { BUILT_IN_MODULES } from "@/core/modules/builtInModules";
import { citoTypeToString } from "@/core/modules/builtInModules";

const COMPLETION_TRIGGER = /[@.\w]/;

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

function isInAtBlock(doc: string, pos: number): boolean {
  if (pos <= 0) return false;
  if (doc[pos - 1] === "@" && (pos < 2 || doc[pos - 2] !== "@")) {
    return true;
  }
  const ranges = collectRazorCodeRanges(doc);
  return (
    isInsideTemplateExpression(pos, ranges) || isInsideTemplateExpression(pos - 1, ranges)
  );
}

function shouldActivateCompletion(context: CompletionContext): boolean {
  const { pos, explicit } = context;
  const doc = context.state.doc.toString();
  if (!isInAtBlock(doc, pos)) return false;
  if (explicit) return true;
  const charBefore = doc[pos - 1] ?? "";
  return COMPLETION_TRIGGER.test(charBefore);
}

function resolveCompletionToken(
  context: CompletionContext
): { text: string; from: number } | null {
  const doc = context.state.doc.toString();
  let end = context.pos;
  while (end > 0 && /\s/.test(doc[end - 1]!)) end--;
  const matched = doc.slice(0, end).match(/[@\w.]*$/);
  if (!matched) return null;
  const text = matched[0];
  if (!text && !context.explicit) return null;
  return { text, from: end - text.length };
}

export function templateCompletionSource(modules: TemplateCompletionModule[]) {
  return (context: CompletionContext): { from: number; options: Completion[] } | null => {
    if (!shouldActivateCompletion(context)) return null;

    const before = resolveCompletionToken(context);
    if (!before) {
      if (!context.explicit) return null;
      return { from: context.pos, options: bindingCompletions(modules) };
    }

    let token = before.text;
    let from = before.from;
    if (token.startsWith("@")) {
      from = before.from + 1;
      token = token.slice(1);
    }

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
