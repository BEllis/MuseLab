import type { Project } from "@/core/model/types";
import type { StageView, StageViewBackground, StageViewProp } from "@/core/view/stageView";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { useActorExpressionUrl } from "@/hooks/useActorExpressionUrl";

function StageBackground({
  project,
  background,
  zIndex,
}: {
  project: Project;
  background: StageViewBackground;
  zIndex: number;
}) {
  const url = useAssetUrl(project, background.assetId);
  if (!url) return null;

  return (
    <img
      src={url}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: background.opacity,
        transform: `translate(${background.offsetXPercent}%, ${background.offsetYPercent}%)`,
        zIndex,
      }}
    />
  );
}

function StagePropImage({
  project,
  prop,
  maxHeightPercent,
}: {
  project: Project;
  prop: StageViewProp;
  maxHeightPercent: number;
}) {
  const expressionUrl = useActorExpressionUrl(project, prop.assetId, prop.variationId ?? null);
  const assetUrl = useAssetUrl(project, prop.assetId);
  const url = expressionUrl || assetUrl;
  if (!url) return null;

  return (
    <img
      src={url}
      alt=""
      style={{
        position: "absolute",
        left: `${prop.leftPercent}%`,
        top: `${prop.topPercent}%`,
        transform: `translate(-50%, -50%) scale(${prop.scale})`,
        maxHeight: `${maxHeightPercent}%`,
        maxWidth: "50%",
        width: "auto",
        height: "auto",
        objectFit: "contain",
        opacity: prop.opacity,
        zIndex: prop.zIndex,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Renders the stage exactly as the scene state describes it.
 *
 * Props are anchored by their image centre on the 16x9 logical stage, and z
 * order comes from the scene rather than from author markup order.
 */
export function StageLayers({
  project,
  view,
  propMaxHeightPercent = 78,
}: {
  project: Project;
  view: StageView;
  propMaxHeightPercent?: number;
}) {
  return (
    <>
      {view.outgoingBackground && (
        <StageBackground
          key={`out:${view.outgoingBackground.assetId}`}
          project={project}
          background={view.outgoingBackground}
          zIndex={-2}
        />
      )}
      {view.background && (
        <StageBackground
          key={`in:${view.background.assetId}`}
          project={project}
          background={view.background}
          zIndex={-1}
        />
      )}
      {view.props.map((prop) => (
        <StagePropImage
          key={prop.id}
          project={project}
          prop={prop}
          maxHeightPercent={propMaxHeightPercent}
        />
      ))}
    </>
  );
}
