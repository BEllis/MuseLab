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
