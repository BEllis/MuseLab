import type { Project } from "../model/types";
import { compileCondition, getConditionBindingNames } from "../cito/compileCondition";
import { compileTemplate, getTemplateBindingNames } from "../cito/compileTemplate";
import type { TemplateContext } from "../cito/runtimeBridge";
import { runTranspiledMethod, transpileCiToJs } from "../cito/transpile";
import { createServiceBindings } from "../services/serviceRuntime";
import { sanitizeHtml } from "./sanitize";

export type { TemplateContext } from "../cito/runtimeBridge";

export type RunTemplateOptions = {
  project: Project;
  disableShake?: boolean;
};

/**
 * Process template string: {{#if}}, {{ Cito expr }}, Format.* calls, then sanitize HTML.
 */
export async function runTemplate(
  template: string,
  context: TemplateContext,
  options: RunTemplateOptions
): Promise<string> {
  if (!template.trim()) return "";

  const compiled = compileTemplate(template, options.project);
  const js = await transpileCiToJs(compiled.ciSource);
  const bindings = createServiceBindings(options.project, context, {
    disableShake: options.disableShake,
  });
  const paramNames = getTemplateBindingNames(options.project);
  const result = runTranspiledMethod(
    js,
    compiled.className,
    "render",
    bindings,
    paramNames
  );

  if (result === undefined || result === null) return "";
  return sanitizeHtml(String(result));
}

/**
 * Evaluate a Cito condition expression (e.g. for edge visibility).
 */
export async function evaluateCondition(
  condition: string | undefined,
  context: Pick<TemplateContext, "state">,
  project: Project
): Promise<boolean> {
  if (!condition || !condition.trim()) return true;

  try {
    const compiled = compileCondition(condition, project);
    const js = await transpileCiToJs(compiled.ciSource);
    const bindings = createServiceBindings(project, {
      ...context,
      setState: () => {},
      emit: () => {},
      call: () => undefined,
      playSound: () => {},
    });
    const paramNames = getConditionBindingNames(project);
    const result = runTranspiledMethod(
      js,
      compiled.className,
      "eval",
      bindings,
      paramNames
    );
    return Boolean(result);
  } catch {
    return false;
  }
}
