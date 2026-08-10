import type { Project, SceneAction } from "../model/types";
import { compileCondition, getConditionBindingNames } from "../cito/compileCondition";
import { compileTemplate, getTemplateBindingNames } from "../cito/compileTemplate";
import {
  compileSceneActions,
  type SceneWrapTemplates,
} from "../scene/compileSceneActions";
import type { TemplateContext } from "../cito/runtimeBridge";
import { runTranspiledMethod, transpileCiToJs } from "../cito/transpile";
import { createModuleBindings } from "../modules/moduleRuntime";
import type { PromptInstruction } from "../prompt/promptInstructions";
import { sanitizeHtml } from "./sanitize";

export type { TemplateContext } from "../cito/runtimeBridge";

export type RunTemplateOptions = {
  project: Project;
  disableShake?: boolean;
};

export type RunSceneActionsOptions = RunTemplateOptions & {
  wrap?: SceneWrapTemplates;
};

export type RunTemplateResult = {
  html: string;
  instructions: PromptInstruction[];
};

/**
 * Process template string: Razor @ syntax, Cito expressions, Format.* calls, then sanitize output HTML.
 */
export async function runTemplate(
  template: string,
  context: TemplateContext,
  options: RunTemplateOptions
): Promise<RunTemplateResult> {
  if (!template.trim()) {
    return { html: "", instructions: [] };
  }

  const compiled = compileTemplate(template, options.project);
  const js = await transpileCiToJs(compiled.ciSource);
  const bindings = createModuleBindings(options.project, context, {
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

  const html =
    result === undefined || result === null ? "" : sanitizeHtml(String(result));
  return {
    html,
    instructions: bindings.promptRenderer.getInstructions(),
  };
}

/**
 * Run an authored scene action list.
 *
 * Actions are compiled to a Cito scene template and executed through the same
 * transpile + bridge path as every other target, so preview cannot drift from
 * exported engines.
 */
export async function runSceneActions(
  actions: SceneAction[],
  context: TemplateContext,
  options: RunSceneActionsOptions
): Promise<RunTemplateResult> {
  if (actions.length === 0) {
    return { html: "", instructions: [] };
  }

  const compiled = compileSceneActions(actions, options.project, { wrap: options.wrap });
  const js = await transpileCiToJs(compiled.ciSource);
  const bindings = createModuleBindings(options.project, context, {
    disableShake: options.disableShake,
  });
  const paramNames = getTemplateBindingNames(options.project);
  const result = runTranspiledMethod(js, compiled.className, "render", bindings, paramNames);

  const html = result === undefined || result === null ? "" : sanitizeHtml(String(result));
  return {
    html,
    instructions: bindings.promptRenderer.getInstructions(),
  };
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
    const bindings = createModuleBindings(project, {
      state: context.state,
      project,
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
