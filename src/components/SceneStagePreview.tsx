import { useEffect, useState } from "react";
import type { Project, Story, StoryNode } from "@/core/model/types";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { ActorRow } from "@/components/ActorImage";
import {
  getNodeChoices,
  hasVisibleRichText,
  renderNodePreviewHtmlForLocale,
  renderNodeSpeakerForLocale,
  type SceneStageChoice,
} from "@/core/view/sceneStage";
import type { PromptsByLocale } from "@/core/locale/prompts";
import {
  compactVnBoxStyle,
  compactVnButtonStyle,
  compactVnSpeakerStyle,
  DIALOGUE_PANEL_FRACTION,
  DIALOGUE_PANEL_HEIGHT,
  vnBoxStyle,
  vnButtonStyle,
  vnSpeakerStyle,
} from "@/core/view/vnStyles";
import {
  aspectRatioToCss,
  DEFAULT_THUMBNAIL_ASPECT_RATIO,
  type AspectRatio,
} from "@/core/view/thumbnailAspectRatio";

type SceneStagePreviewProps = {
  project: Project;
  story: Story;
  storyId: string;
  promptsByLocale: PromptsByLocale;
  node: Pick<StoryNode, "id" | "backdropId" | "actorConfigs">;
  locale?: string;
  variant?: "compact" | "full";
  dialogueHtml?: string;
  dialogueSpeaker?: string;
  choices?: SceneStageChoice[];
  singleChoice?: boolean;
  showContinue?: boolean;
  onChoice?: (targetNodeId: string) => void;
  onContinue?: () => void;
  onRestart?: () => void;
  thumbnailAspectRatio?: AspectRatio;
  /** Canvas thumbnails: skip shake animation markup for a static preview. */
  disableShake?: boolean;
  style?: React.CSSProperties;
};

export function SceneStagePreview({
  project,
  story,
  storyId,
  promptsByLocale,
  node,
  locale,
  variant = "compact",
  dialogueHtml,
  dialogueSpeaker,
  choices: choicesProp,
  singleChoice: singleChoiceProp,
  showContinue = false,
  onChoice,
  onContinue,
  onRestart,
  thumbnailAspectRatio = DEFAULT_THUMBNAIL_ASPECT_RATIO,
  disableShake = false,
  style,
}: SceneStagePreviewProps) {
  const backdropUrl = useAssetUrl(project, node.backdropId ?? null);
  const [previewHtml, setPreviewHtml] = useState(dialogueHtml ?? "");
  const [previewSpeaker, setPreviewSpeaker] = useState(dialogueSpeaker ?? "");
  const [previewChoices, setPreviewChoices] = useState<SceneStageChoice[]>(choicesProp ?? []);

  useEffect(() => {
    if (choicesProp !== undefined) {
      setPreviewChoices(choicesProp);
      return;
    }
    let cancelled = false;
    void getNodeChoices(story, storyId, node.id, project, promptsByLocale, locale).then((next) => {
      if (!cancelled) setPreviewChoices(next);
    });
    return () => {
      cancelled = true;
    };
  }, [choicesProp, story, storyId, project, node.id, promptsByLocale, locale]);

  useEffect(() => {
    if (dialogueHtml !== undefined) {
      setPreviewHtml(dialogueHtml);
      return;
    }
    let cancelled = false;
    void renderNodePreviewHtmlForLocale(
      story,
      storyId,
      project,
      promptsByLocale,
      node.id,
      locale,
      { disableShake }
    ).then((next) => {
      if (!cancelled) setPreviewHtml(next);
    });
    return () => {
      cancelled = true;
    };
  }, [dialogueHtml, story, storyId, project, promptsByLocale, node.id, locale, disableShake]);

  useEffect(() => {
    if (dialogueSpeaker !== undefined) {
      setPreviewSpeaker(dialogueSpeaker);
      return;
    }
    let cancelled = false;
    void renderNodeSpeakerForLocale(
      story,
      storyId,
      project,
      promptsByLocale,
      node.id,
      locale,
      { disableShake }
    ).then((next) => {
      if (!cancelled) setPreviewSpeaker(next);
    });
    return () => {
      cancelled = true;
    };
  }, [dialogueSpeaker, story, storyId, project, promptsByLocale, node.id, locale, disableShake]);

  const html = dialogueHtml ?? previewHtml;
  const speakerHtml = dialogueSpeaker ?? previewSpeaker;
  const choices = choicesProp ?? previewChoices;
  const hasDialogueContent = hasVisibleRichText(html) || hasVisibleRichText(speakerHtml);
  const hasSpeaker = hasVisibleRichText(speakerHtml);
  const hasOptions = choices.some((choice) => choice.optionText);
  const compact = variant === "compact";
  const singleChoice = singleChoiceProp ?? (choices.length === 1 && !hasOptions);
  const continueOnClick = showContinue && !compact;
  const showCaptionPanel = hasDialogueContent;
  const choiceAreaBottom =
    showCaptionPanel && choices.length > 0 && !singleChoice
      ? compact
        ? `${DIALOGUE_PANEL_FRACTION * 100}%`
        : DIALOGUE_PANEL_HEIGHT
      : 0;
  const needsStageContinue =
    !compact && !hasDialogueContent && (singleChoice || continueOnClick);

  const boxStyle = compact ? compactVnBoxStyle : vnBoxStyle;
  const buttonStyle = compact ? compactVnButtonStyle : vnButtonStyle;
  const speakerStyle = compact ? compactVnSpeakerStyle : vnSpeakerStyle;

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
        actorConfigs={node.actorConfigs ?? []}
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
            bottom: choiceAreaBottom,
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
            {choices.map(({ edge, targetNode, optionText }) => (
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
                {optionText || `Go to ${targetNode.label ?? targetNode.id}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsStageContinue && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            cursor: "pointer",
          }}
          onClick={() =>
            singleChoice ? onChoice?.(choices[0].targetNode.id) : onContinue?.()
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              singleChoice ? onChoice?.(choices[0].targetNode.id) : onContinue?.();
            }
          }}
        >
          <span
            style={{
              position: "absolute",
              bottom: "24px",
              right: "24px",
              color: "#fff",
              fontSize: "18px",
              lineHeight: 1,
              fontFamily: "inherit",
              textShadow: "0 1px 6px rgba(0, 0, 0, 0.8)",
            }}
          >
            Continue &gt;&gt;
          </span>
        </div>
      )}

      {showCaptionPanel && (
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
            ...((singleChoice || continueOnClick) &&
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
          {...(continueOnClick && {
            onClick: () => onContinue?.(),
            role: "button",
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onContinue?.();
              }
            },
          })}
        >
          {hasSpeaker && (
            <div
              dangerouslySetInnerHTML={{ __html: speakerHtml }}
              style={speakerStyle}
            />
          )}
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
              lineHeight: compact ? 1.25 : 1.6,
              ...(hasSpeaker && {
                paddingTop: compact ? "1.2em" : "1.4em",
              }),
            }}
          />
          {(singleChoice || continueOnClick) && (
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

        {!compact && choices.length === 0 && !showContinue && (
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
      )}
    </div>
  );
}
