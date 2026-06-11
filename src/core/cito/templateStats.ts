import {
  collectRazorCodeRanges,
  parseRazorTemplate,
  type TemplateSurfaceSegment,
} from "./parseRazorTemplate";

function literalTextFromSegments(segments: TemplateSurfaceSegment[]): string {
  let text = "";
  for (const segment of segments) {
    if (segment.kind === "literal") {
      text += segment.value;
      continue;
    }
    if (segment.kind === "if") {
      text += literalTextFromSegments(segment.body);
    }
  }
  return text;
}

function literalTextFromTemplateFallback(template: string): string {
  const ranges = [...collectRazorCodeRanges(template)].sort((a, b) => a.from - b.from);
  let text = "";
  let pos = 0;
  for (const range of ranges) {
    if (pos < range.from) text += template.slice(pos, range.from);
    pos = range.to;
  }
  if (pos < template.length) text += template.slice(pos);
  return text;
}

export function getTemplateLiteralText(template: string): string {
  if (!template) return "";
  try {
    return literalTextFromSegments(parseRazorTemplate(template));
  } catch {
    return literalTextFromTemplateFallback(template);
  }
}

export function countTemplateLiteralChars(template: string): number {
  return getTemplateLiteralText(template).length;
}

export function templateHasPlaySound(template: string): boolean {
  if (!template) return false;
  return /\brt\.PlaySound\s*\(/.test(template) || /\brt\.PlaySoundClip\s*\(/.test(template);
}
