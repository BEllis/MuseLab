import type { CSSProperties } from "react";
import type { ActorSceneConfig, Project } from "@/core/model/types";
import { useActorExpressionUrl } from "@/hooks/useActorExpressionUrl";

export function actorRowJustifyContent(count: number): CSSProperties["justifyContent"] {
  if (count <= 1) return "center";
  if (count === 2 || count === 3) return "space-between";
  return "space-evenly";
}

type ActorImageProps = {
  project: Project;
  assetId: string;
  expressionId: string;
  maxHeight?: string | number;
};

export function ActorImage({ project, assetId, expressionId, maxHeight = "100%" }: ActorImageProps) {
  const url = useActorExpressionUrl(project, assetId, expressionId);
  if (!url) return null;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        minWidth: 0,
      }}
    >
      <img
        src={url}
        alt=""
        style={{
          maxHeight,
          width: "auto",
          height: "auto",
          objectFit: "contain",
          objectPosition: "bottom",
          display: "block",
        }}
      />
    </div>
  );
}

type ActorRowProps = {
  project: Project;
  actorConfigs: ActorSceneConfig[];
  padding?: string;
  actorMaxHeight?: string | number;
  zIndex?: number;
};

export function ActorRow({
  project,
  actorConfigs,
  padding = "24px 32px 0",
  actorMaxHeight,
  zIndex = 0,
}: ActorRowProps) {
  if (actorConfigs.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "stretch",
        justifyContent: actorRowJustifyContent(actorConfigs.length),
        padding,
        pointerEvents: "none",
      }}
    >
      {actorConfigs.map((config) => (
        <ActorImage
          key={config.assetId}
          project={project}
          assetId={config.assetId}
          expressionId={config.expressionId}
          maxHeight={actorMaxHeight}
        />
      ))}
    </div>
  );
}
