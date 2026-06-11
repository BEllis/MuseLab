import type { Story } from "../model/types";

function wrapTemplate(template: string, start?: string, end?: string): string {
  const prefix = start?.trim() ?? "";
  const suffix = end?.trim() ?? "";
  if (!prefix && !suffix) return template;
  return `${prefix}${template}${suffix}`;
}

export function wrapStoryPromptTemplate(
  story: Pick<Story, "promptStartTemplate" | "promptEndTemplate">,
  template: string
): string {
  return wrapTemplate(template, story.promptStartTemplate, story.promptEndTemplate);
}

export function wrapStorySpeakerTemplate(
  story: Pick<Story, "speakerStartTemplate" | "speakerEndTemplate">,
  template: string
): string {
  return wrapTemplate(template, story.speakerStartTemplate, story.speakerEndTemplate);
}

/** Map a validation range from a wrapped template back to the inner editor text. */
export function unwrapStoryTemplateErrorRange(
  range: { from?: number; to?: number },
  startTemplate: string | undefined,
  innerLength: number
): { from?: number; to?: number } {
  if (range.from === undefined || range.to === undefined) return {};
  const prefixLen = startTemplate?.trim().length ?? 0;
  const from = range.from - prefixLen;
  const to = range.to - prefixLen;
  if (from < 0 || to > innerLength || from >= to) return {};
  return { from, to };
}
