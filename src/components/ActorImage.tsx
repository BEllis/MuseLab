import type { CSSProperties } from "react";
import type { Project } from "@/core/model/types";
import { useAssetUrl } from "@/hooks/useAssetUrl";

export function actorRowJustifyContent(count: number): CSSProperties["justifyContent"] {
  if (count <= 1) return "center";
  if (count === 2 || count === 3) return "space-between";
  return "space-evenly";
}

type ActorImageProps = {
  project: Project;
  assetId: string;
  maxHeight?: string | number;
};

export function ActorImage({ project, assetId, maxHeight = "100%" }: ActorImageProps) {
  const url = useAssetUrl(project, assetId);
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
  actorIds: string[];
  padding?: string;
  actorMaxHeight?: string | number;
  zIndex?: number;
};

export function ActorRow({
  project,
  actorIds,
  padding = "24px 32px 0",
  actorMaxHeight,
  zIndex = 0,
}: ActorRowProps) {
  if (actorIds.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "stretch",
        justifyContent: actorRowJustifyContent(actorIds.length),
        padding,
        pointerEvents: "none",
      }}
    >
      {actorIds.map((actorId) => (
        <ActorImage
          key={actorId}
          project={project}
          assetId={actorId}
          maxHeight={actorMaxHeight}
        />
      ))}
    </div>
  );
}
