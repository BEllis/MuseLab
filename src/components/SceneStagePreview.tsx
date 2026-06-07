import { useMemo } from "react";
import type { Project, StoryNode } from "@/core/model/types";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { ActorRow } from "@/components/ActorImage";
import {
  getNodeChoices,
  renderNodePreviewHtml,
  type SceneStageChoice,
} from "@/core/view/sceneStage";
import {
  compactVnBoxStyle,
  compactVnButtonStyle,
  DIALOGUE_PANEL_FRACTION,
  DIALOGUE_PANEL_HEIGHT,
  vnBoxStyle,
  vnButtonStyle,
} from "@/core/view/vnStyles";
import {
  aspectRatioToCss,
  DEFAULT_THUMBNAIL_ASPECT_RATIO,
  type AspectRatio,
} from "@/core/view/thumbnailAspectRatio";

type SceneStagePreviewProps = {
  project: Project;
  node: Pick<StoryNode, "id" | "backdropId" | "actorIds" | "textTemplate">;
  variant?: "compact" | "full";
  dialogueHtml?: string;
  choices?: SceneStageChoice[];
  singleChoice?: boolean;
  onChoice?: (targetNodeId: string) => void;
  onRestart?: () => void;
  thumbnailAspectRatio?: AspectRatio;
  style?: React.CSSProperties;
};

export function SceneStagePreview({
  project,
  node,
  variant = "compact",
  dialogueHtml,
  choices: choicesProp,
  singleChoice: singleChoiceProp,
  onChoice,
  onRestart,
  thumbnailAspectRatio = DEFAULT_THUMBNAIL_ASPECT_RATIO,
  style,
}: SceneStagePreviewProps) {
  const backdropUrl = useAssetUrl(project, node.backdropId);
  const choices = useMemo(
    () => choicesProp ?? getNodeChoices(project, node.id),
    [choicesProp, project, node.id]
  );
  const html = useMemo(
    () => dialogueHtml ?? renderNodePreviewHtml(node.textTemplate, project.globalState),
    [dialogueHtml, node.textTemplate, project.globalState]
  );
  const hasOptions = choices.some((choice) => choice.edge.optionText);
  const singleChoice = singleChoiceProp ?? (choices.length === 1 && !hasOptions);
  const compact = variant === "compact";

  const boxStyle = compact ? compactVnBoxStyle : vnBoxStyle;
  const buttonStyle = compact ? compactVnButtonStyle : vnButtonStyle;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: compact ? aspectRatioToCss(thumbnailAspectRatio) : undefined,
        height: compact ? undefined : "100%",
        overflow: "hidden",
        background: "#0a0a12",
        ...style,
      }}
    >
      {backdropUrl && (
        <img
          src={backdropUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      <ActorRow
        project={project}
        actorIds={node.actorIds}
        padding={compact ? "6px 8px 0" : "24px 32px 0"}
        zIndex={0}
      />

      {choices.length > 0 && !singleChoice && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: compact ? `${DIALOGUE_PANEL_FRACTION * 100}%` : DIALOGUE_PANEL_HEIGHT,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: compact ? "4px" : "24px",
            pointerEvents: compact ? "none" : undefined,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: compact ? "2px" : "8px",
              maxWidth: "80%",
              width: "max-content",
            }}
          >
            {choices.map(({ edge, targetNode }) => (
              <button
                key={edge.id}
                type="button"
                disabled={compact}
                onClick={compact ? undefined : () => onChoice?.(targetNode.id)}
                style={{
                  ...buttonStyle,
                  cursor: compact ? "default" : "pointer",
                  pointerEvents: compact ? "none" : undefined,
                }}
              >
                {edge.optionText || `Go to ${targetNode.label ?? targetNode.id}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: compact ? `${DIALOGUE_PANEL_FRACTION * 100}%` : DIALOGUE_PANEL_HEIGHT,
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: compact ? "3px 4px 4px" : "16px 24px 24px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)",
          pointerEvents: compact ? "none" : undefined,
        }}
      >
        <div
          style={{
            ...boxStyle,
            position: "relative",
            height: compact ? "3.6em" : "8em",
            minHeight: compact ? "3.6em" : "8em",
            overflow: compact ? "hidden" : "auto",
            ...(singleChoice &&
              !compact && {
                cursor: "pointer",
                userSelect: "none",
              }),
          }}
          {...(singleChoice &&
            !compact && {
              onClick: () => onChoice?.(choices[0].targetNode.id),
              role: "button",
              tabIndex: 0,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChoice?.(choices[0].targetNode.id);
                }
              },
            })}
        >
          <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: compact ? 1.25 : 1.6 }} />
          {singleChoice && (
            <span
              style={{
                position: "absolute",
                bottom: compact ? "1px" : "8px",
                right: compact ? "3px" : "12px",
                color: "#0f172a",
                fontSize: compact ? "5px" : "18px",
                lineHeight: 1,
                fontFamily: "inherit",
              }}
            >
              Continue &gt;&gt;
            </span>
          )}
        </div>

        {!compact && choices.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <p style={{ margin: 0, padding: "8px 0", color: "#334155", fontSize: "14px" }}>
              End of story.
            </p>
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: "#1e5a8a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(30, 90, 138, 0.3)",
                }}
              >
                Restart
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
