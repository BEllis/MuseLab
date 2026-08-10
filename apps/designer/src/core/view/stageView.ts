import type { SceneSnapshot } from "@/core/scene/sceneDirector";
import type { SceneSummary } from "@/core/scene/sceneSummary";
import { STAGE_HEIGHT, STAGE_WIDTH } from "@/core/scene/positions";

export type StageViewProp = {
  id: string;
  assetId: string;
  variationId?: string;
  /** Percentage of stage width for the prop's centre. */
  leftPercent: number;
  /** Percentage of stage height from the top for the prop's centre. */
  topPercent: number;
  zIndex: number;
  opacity: number;
  scale: number;
};

export type StageViewBackground = {
  assetId: string;
  opacity: number;
  /** Slide offset as a percentage of stage size. */
  offsetXPercent: number;
  offsetYPercent: number;
};

export type StageView = {
  background: StageViewBackground | null;
  /** Kept mounted during a background transition so both layers can render. */
  outgoingBackground: StageViewBackground | null;
  props: StageViewProp[];
};

export const EMPTY_STAGE_VIEW: StageView = {
  background: null,
  outgoingBackground: null,
  props: [],
};

function toPercent(x: number, y: number): { leftPercent: number; topPercent: number } {
  return {
    leftPercent: (x / STAGE_WIDTH) * 100,
    topPercent: (1 - y / STAGE_HEIGHT) * 100,
  };
}

export function stageViewFromSnapshot(snapshot: SceneSnapshot): StageView {
  const background = (
    value: SceneSnapshot["background"]
  ): StageViewBackground | null =>
    value
      ? {
          assetId: value.assetId,
          opacity: value.opacity,
          offsetXPercent: (value.offsetX / STAGE_WIDTH) * 100,
          offsetYPercent: (-value.offsetY / STAGE_HEIGHT) * 100,
        }
      : null;

  return {
    background: background(snapshot.background),
    outgoingBackground: background(snapshot.outgoingBackground),
    props: snapshot.props
      .filter((prop) => prop.visible)
      .map((prop) => ({
        id: prop.id,
        assetId: prop.assetId,
        variationId: prop.variationId,
        ...toPercent(prop.x, prop.y),
        zIndex: prop.zIndex,
        opacity: prop.opacity,
        scale: prop.scale,
      })),
  };
}

/** Static end-state view used for canvas thumbnails and idle previews. */
export function stageViewFromSummary(summary: SceneSummary): StageView {
  return {
    background: summary.backgroundAssetId
      ? {
          assetId: summary.backgroundAssetId,
          opacity: 1,
          offsetXPercent: 0,
          offsetYPercent: 0,
        }
      : null,
    outgoingBackground: null,
    props: summary.props.map((prop) => ({
      id: prop.id,
      assetId: prop.assetId,
      variationId: prop.variationId,
      ...toPercent(prop.x, prop.y),
      zIndex: prop.zIndex,
      opacity: 1,
      scale: 1,
    })),
  };
}
