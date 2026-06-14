import type { AspectRatio, Project } from "@/core/model/types";
import { parseAspectRatio } from "@/core/view/thumbnailAspectRatio";

export const DEFAULT_PLAYER_RESOLUTION: AspectRatio = { width: 1280, height: 720 };

export const STANDARD_PLAYER_RESOLUTIONS: {
  key: string;
  width: number;
  height: number;
  label: string;
}[] = [
  { key: "1920x1080", width: 1920, height: 1080, label: "1920 × 1080 (16:9)" },
  { key: "1280x720", width: 1280, height: 720, label: "1280 × 720 (16:9)" },
  { key: "1366x768", width: 1366, height: 768, label: "1366 × 768 (16:9)" },
  { key: "2560x1440", width: 2560, height: 1440, label: "2560 × 1440 (16:9)" },
  { key: "3840x2160", width: 3840, height: 2160, label: "3840 × 2160 (16:9)" },
  { key: "1280x800", width: 1280, height: 800, label: "1280 × 800 (16:10)" },
  { key: "1920x1200", width: 1920, height: 1200, label: "1920 × 1200 (16:10)" },
  { key: "800x600", width: 800, height: 600, label: "800 × 600 (4:3)" },
  { key: "1024x768", width: 1024, height: 768, label: "1024 × 768 (4:3)" },
  { key: "1600x1200", width: 1600, height: 1200, label: "1600 × 1200 (4:3)" },
];

export const CUSTOM_PLAYER_RESOLUTION_KEY = "custom";

export function getProjectPlayerResolution(project: Project): AspectRatio {
  return parseAspectRatio(project.playerResolution) ?? DEFAULT_PLAYER_RESOLUTION;
}

export function findPlayerResolutionPresetKey(resolution: AspectRatio): string {
  const preset = STANDARD_PLAYER_RESOLUTIONS.find(
    (item) => item.width === resolution.width && item.height === resolution.height
  );
  return preset?.key ?? CUSTOM_PLAYER_RESOLUTION_KEY;
}

export function clampPlayerResolution(resolution: AspectRatio): AspectRatio {
  const width = Math.min(7680, Math.max(1, Math.round(resolution.width)));
  const height = Math.min(4320, Math.max(1, Math.round(resolution.height)));
  return { width, height };
}

/** Scale a player-resolution stage to fit an available area (matches PlayerView framing). */
export function computeStagePreviewScale(
  availableWidth: number,
  availableHeight: number,
  resolution: AspectRatio,
  maxScale = 4,
): { scale: number; scaledWidth: number; scaledHeight: number } {
  if (availableWidth <= 0 || availableHeight <= 0) {
    return { scale: 0, scaledWidth: 0, scaledHeight: 0 };
  }
  const scale = Math.min(
    availableWidth / resolution.width,
    availableHeight / resolution.height,
    maxScale,
  );
  return {
    scale,
    scaledWidth: resolution.width * scale,
    scaledHeight: resolution.height * scale,
  };
}
