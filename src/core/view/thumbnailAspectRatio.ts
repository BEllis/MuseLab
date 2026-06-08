import type { AspectRatio, Project } from "@/core/model/types";

export type { AspectRatio };

export type AspectRatioPresetGroup = "general" | "phone" | "tablet";

export const THUMBNAIL_ASPECT_RATIO_GROUP_ORDER: AspectRatioPresetGroup[] = [
  "general",
  "phone",
  "tablet",
];

export const THUMBNAIL_ASPECT_RATIO_GROUP_LABELS: Record<AspectRatioPresetGroup, string> = {
  general: "General",
  phone: "Phone",
  tablet: "Tablet",
};

export const THUMBNAIL_ASPECT_RATIO_PRESETS: {
  key: string;
  label: string;
  group: AspectRatioPresetGroup;
  ratio: AspectRatio;
}[] = [
  { key: "16:9", label: "16:9", group: "general", ratio: { width: 16, height: 9 } },
  { key: "16:10", label: "16:10", group: "general", ratio: { width: 16, height: 10 } },
  { key: "4:3", label: "4:3", group: "general", ratio: { width: 4, height: 3 } },
  { key: "3:2", label: "3:2", group: "general", ratio: { width: 3, height: 2 } },
  { key: "1:1", label: "1:1", group: "general", ratio: { width: 1, height: 1 } },
  {
    key: "phone-landscape-20:9",
    label: "Landscape (20:9)",
    group: "phone",
    ratio: { width: 20, height: 9 },
  },
  {
    key: "phone-landscape-16:9",
    label: "Landscape (16:9)",
    group: "phone",
    ratio: { width: 16, height: 9 },
  },
  {
    key: "phone-portrait-9:20",
    label: "Portrait (9:20)",
    group: "phone",
    ratio: { width: 9, height: 20 },
  },
  {
    key: "phone-portrait-9:16",
    label: "Portrait (9:16)",
    group: "phone",
    ratio: { width: 9, height: 16 },
  },
  {
    key: "tablet-landscape-4:3",
    label: "Landscape (4:3)",
    group: "tablet",
    ratio: { width: 4, height: 3 },
  },
  {
    key: "tablet-landscape-16:10",
    label: "Landscape (16:10)",
    group: "tablet",
    ratio: { width: 16, height: 10 },
  },
  {
    key: "tablet-portrait-3:4",
    label: "Portrait (3:4)",
    group: "tablet",
    ratio: { width: 3, height: 4 },
  },
  {
    key: "tablet-portrait-10:16",
    label: "Portrait (10:16)",
    group: "tablet",
    ratio: { width: 10, height: 16 },
  },
];

export const DEFAULT_THUMBNAIL_ASPECT_RATIO: AspectRatio =
  THUMBNAIL_ASPECT_RATIO_PRESETS[0].ratio;

export function aspectRatioKey(ratio: AspectRatio): string {
  return `${ratio.width}:${ratio.height}`;
}

export function aspectRatioEquals(a: AspectRatio, b: AspectRatio): boolean {
  return a.width === b.width && a.height === b.height;
}

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

export function getProjectThumbnailAspectRatio(project: Project): AspectRatio {
  return parseAspectRatio(project.thumbnailAspectRatio) ?? DEFAULT_THUMBNAIL_ASPECT_RATIO;
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

export function findPresetKey(ratio: AspectRatio): string {
  const preset = THUMBNAIL_ASPECT_RATIO_PRESETS.find((item) =>
    aspectRatioEquals(item.ratio, ratio)
  );
  return preset?.key ?? "custom";
}
