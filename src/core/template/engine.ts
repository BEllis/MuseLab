import { compileCondition } from "../cito/compileCondition";
import { compileTemplate } from "../cito/compileTemplate";
import {
  createMuseLabRuntimeBridge,
  type TemplateContext,
} from "../cito/runtimeBridge";
import { runTranspiledMethod, transpileCiToJs } from "../cito/transpile";
import { createFormatRuntime } from "../cito/formatRuntime";
import { sanitizeHtml } from "./sanitize";

export type { TemplateContext } from "../cito/runtimeBridge";

export type RunTemplateOptions = {
  disableShake?: boolean;
};

/**
 * Process template string: {{#if}}, {{ Cito expr }}, Format.* calls, then sanitize HTML.
 */
export async function runTemplate(
  template: string,
  context: TemplateContext,
  options: RunTemplateOptions = {}
): Promise<string> {
  if (!template.trim()) return "";

  const compiled = compileTemplate(template);
  const js = await transpileCiToJs(compiled.ciSource);
  const rt = createMuseLabRuntimeBridge(context);
  const format = createFormatRuntime({ disableShake: options.disableShake });
  const result = runTranspiledMethod(js, compiled.className, "render", rt, format);

  if (result === undefined || result === null) return "";
  return sanitizeHtml(String(result));
}

/**
 * Evaluate a Cito condition expression (e.g. for edge visibility).
 */
export async function evaluateCondition(
  condition: string | undefined,
  context: Pick<TemplateContext, "state">
): Promise<boolean> {
  if (!condition || !condition.trim()) return true;

  try {
    const compiled = compileCondition(condition);
    const js = await transpileCiToJs(compiled.ciSource);
    const rt = createMuseLabRuntimeBridge({
      ...context,
      setState: () => {},
      emit: () => {},
      call: () => undefined,
      playSound: () => {},
    });
    const result = runTranspiledMethod(js, compiled.className, "eval", rt);
    return Boolean(result);
  } catch {
    return false;
  }
}
