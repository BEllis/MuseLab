import type { AspectRatio } from "@/core/model/types";

export type { AspectRatio };

/** Fixed aspect ratio for the viewable VN stage (letterboxed inside the target frame). */
export const STAGE_CONTENT_ASPECT_RATIO: AspectRatio = { width: 16, height: 9 };

/** Canvas thumbnails always use the stage content aspect. */
export const DEFAULT_THUMBNAIL_ASPECT_RATIO: AspectRatio = STAGE_CONTENT_ASPECT_RATIO;

export function aspectRatioToCss(ratio: AspectRatio): string {
  return `${ratio.width} / ${ratio.height}`;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isInteger(value);
}

export function parseAspectRatio(value: unknown): AspectRatio | null {
  if (!value || typeof value !== "object") return null;
  const { width, height } = value as AspectRatio;
  if (!isPositiveInt(width) || !isPositiveInt(height)) return null;
  return { width, height };
}

/** Largest width/height that fits `ratio` inside a box without cropping. */
export function fitAspectRatioInBox(
  boxWidth: number,
  boxHeight: number,
  ratio: AspectRatio
): { width: number; height: number } {
  if (boxWidth <= 0 || boxHeight <= 0) return { width: 0, height: 0 };
  const contentAspect = ratio.width / ratio.height;
  const boxAspect = boxWidth / boxHeight;
  if (boxAspect > contentAspect) {
    return { width: boxHeight * contentAspect, height: boxHeight };
  }
  return { width: boxWidth, height: boxWidth / contentAspect };
}

export type LetterboxContentRect = {
  width: number;
  height: number;
  left: number;
  top: number;
};

/** Centered content rect that preserves `contentAspect` inside a target frame. */
export function letterboxContentRect(
  boxWidth: number,
  boxHeight: number,
  contentAspect: AspectRatio = STAGE_CONTENT_ASPECT_RATIO
): LetterboxContentRect {
  const { width, height } = fitAspectRatioInBox(boxWidth, boxHeight, contentAspect);
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0, left: 0, top: 0 };
  }
  return {
    width,
    height,
    left: (boxWidth - width) / 2,
    top: (boxHeight - height) / 2,
  };
}
