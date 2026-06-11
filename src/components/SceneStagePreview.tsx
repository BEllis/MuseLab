// @refresh reset
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Project, Story, StoryNode } from "@/core/model/types";
import type { PromptInstruction } from "@/core/prompt/promptInstructions";
import {
  PromptInstructionExecutor,
  shouldUsePromptExecutor,
  type DialoguePlaybackGate,
} from "@/components/PromptInstructionExecutor";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { ActorRow } from "@/components/ActorImage";
import {
  getNodeChoices,
  hasVisibleRichText,
  renderNodePreviewHtmlForLocale,
  renderNodeSpeakerForLocale,
  renderSpeakerTemplateForStory,
  type SceneStageChoice,
} from "@/core/view/sceneStage";
import type { PromptsByLocale } from "@/core/locale/prompts";
import {
  compactVnButtonStyle,
  DIALOGUE_PANEL_FRACTION,
  DIALOGUE_PANEL_HEIGHT,
  compactVnSpeakerTabStyle,
  vnButtonStyle,
  dialogueContentHeightPx,
  dialogueHintReservePx,
  vnDialogueBoxChromeStyle,
  vnDialogueHintCornerStyle,
  vnDialogueScrollStyle,
  vnSpeakerTabStyle,
} from "@/core/view/vnStyles";
import {
  aspectRatioToCss,
  DEFAULT_THUMBNAIL_ASPECT_RATIO,
  type AspectRatio,
} from "@/core/view/thumbnailAspectRatio";
import {
  appendInlineDialogueMoreHint,
  clampDialogueStartLine,
  getDialoguePageState,
  measureVisualLineOffsets,
  shouldResetDialogueLinePage,
} from "@/core/view/dialogueLinePagination";

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
  templateState?: Record<string, unknown>;
  promptInstructions?: PromptInstruction[];
  onPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
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
  templateState,
  promptInstructions = [],
  onPlaySound,
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
  const [promptComplete, setPromptComplete] = useState(true);
  const playbackGateRef = useRef<DialoguePlaybackGate | undefined>(undefined);
  const handlePlaybackGateChange = useCallback((gate: DialoguePlaybackGate) => {
    playbackGateRef.current = gate;
  }, []);

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
  const initialSpeakerHtml = dialogueSpeaker ?? previewSpeaker;
  const templateRuntimeState = templateState ?? story.globalState;
  const renderSpeakerTemplate = useCallback(
    (template: string) =>
      renderSpeakerTemplateForStory(story, template, templateRuntimeState, {
        project,
        disableShake,
      }),
    [story, templateRuntimeState, project, disableShake]
  );
  const choices = choicesProp ?? previewChoices;
  const hasDialogueContent = hasVisibleRichText(html) || hasVisibleRichText(initialSpeakerHtml);
  const hasOptions = choices.some((choice) => choice.optionText);
  const compact = variant === "compact";
  const usePromptExecutor =
    !compact && shouldUsePromptExecutor(promptInstructions);
  const interactionsEnabled = compact || promptComplete;
  const singleChoice = singleChoiceProp ?? (choices.length === 1 && !hasOptions);
  const continueOnClick = showContinue && !compact && interactionsEnabled;
  const handlePromptComplete = useCallback(() => {
    setPromptComplete(true);
  }, []);

  const handlePromptSkipChange = useCallback((skipped: boolean) => {
    if (skipped) setPromptComplete(true);
  }, []);

  useEffect(() => {
    setPromptComplete(!usePromptExecutor);
    playbackGateRef.current = undefined;
  }, [html, promptInstructions, usePromptExecutor]);
  const showCaptionPanel = hasDialogueContent;
  const choiceAreaBottom =
    showCaptionPanel && choices.length > 0 && !singleChoice
      ? compact
        ? `${DIALOGUE_PANEL_FRACTION * 100}%`
        : DIALOGUE_PANEL_HEIGHT
      : 0;
  const needsStageContinue =
    !compact && !hasDialogueContent && interactionsEnabled && (singleChoice || showContinue);

  const buttonStyle = compact ? compactVnButtonStyle : vnButtonStyle;
  const speakerTabStyle = compact ? compactVnSpeakerTabStyle : vnSpeakerTabStyle;

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
                disabled={compact || !interactionsEnabled}
                onClick={compact || !interactionsEnabled ? undefined : () => onChoice?.(targetNode.id)}
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
          <ContinueHint
            compact={false}
            tone="light"
            style={{
              position: "absolute",
              bottom: "24px",
              right: "24px",
            }}
          />
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
        {usePromptExecutor ? (
          <PromptInstructionExecutor
            fullHtml={html}
            initialSpeakerHtml={initialSpeakerHtml}
            instructions={promptInstructions}
            renderSpeakerTemplate={renderSpeakerTemplate}
            playbackGateRef={playbackGateRef}
            onPlaySound={onPlaySound}
            onComplete={handlePromptComplete}
            onSkipChange={handlePromptSkipChange}
          >
            {({
              visibleHtml,
              visibleSpeakerHtml,
              isComplete,
              isAwaitingContinue,
              isRevealing,
              resume,
              skipRevealChunk,
            }) => (
              <DialogueCaptionBox
                compact={compact}
                hasSpeaker={hasVisibleRichText(visibleSpeakerHtml)}
                speakerHtml={visibleSpeakerHtml}
                speakerTabStyle={speakerTabStyle}
                dialogueHtml={visibleHtml}
                linePaginationEnabled={!compact && (isComplete || isAwaitingContinue)}
                isRevealing={!isComplete && isRevealing}
                isAwaitingContinue={!isComplete && isAwaitingContinue}
                onPlaybackGateChange={handlePlaybackGateChange}
                showContinueHint={
                  (singleChoice || (showContinue && !compact && isComplete)) && isComplete
                }
                interactive={!compact}
                onActivate={() => {
                  if (!isComplete) {
                    if (isAwaitingContinue) {
                      resume();
                    } else {
                      skipRevealChunk();
                    }
                    return;
                  }
                  if (singleChoice) {
                    onChoice?.(choices[0].targetNode.id);
                    return;
                  }
                  if (showContinue) {
                    onContinue?.();
                  }
                }}
              />
            )}
          </PromptInstructionExecutor>
        ) : (
          <DialogueCaptionBox
            compact={compact}
            hasSpeaker={hasVisibleRichText(initialSpeakerHtml)}
            speakerHtml={initialSpeakerHtml}
            speakerTabStyle={speakerTabStyle}
            dialogueHtml={html}
            linePaginationEnabled={interactionsEnabled}
            showContinueHint={(singleChoice || continueOnClick) && interactionsEnabled}
            interactive={!compact && (singleChoice || continueOnClick || usePromptExecutor)}
            onActivate={() => {
              if (singleChoice) {
                onChoice?.(choices[0].targetNode.id);
                return;
              }
              if (continueOnClick) {
                onContinue?.();
              }
            }}
          />
        )}

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

function ContinueHintIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M4.5 3.5 9.5 8 4.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 3.5 13.5 8 8.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ContinueHint({
  compact,
  tone,
  style,
}: {
  compact: boolean;
  tone: "light" | "dark";
  style?: React.CSSProperties;
}) {
  const fontSize = compact ? "4.5px" : "13px";
  const iconSize = compact ? 5 : 12;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? "1px" : "3px",
        color: tone === "light" ? "#fff" : "#0f172a",
        fontSize,
        lineHeight: 1,
        fontFamily: "inherit",
        ...(tone === "light" && { textShadow: "0 1px 6px rgba(0, 0, 0, 0.8)" }),
        ...style,
      }}
    >
      Continue
      <ContinueHintIcon size={iconSize} />
    </span>
  );
}

function DialogueCaptionHint({ compact }: { compact: boolean }) {
  return (
    <div className="muselab-dialogue-hint">
      <ContinueHint compact={compact} tone="dark" />
    </div>
  );
}

function DialogueCaptionBox({
  compact,
  hasSpeaker,
  speakerHtml,
  speakerTabStyle,
  dialogueHtml,
  linePaginationEnabled = true,
  isRevealing = false,
  isAwaitingContinue = false,
  onPlaybackGateChange,
  showContinueHint,
  interactive,
  onActivate,
}: {
  compact: boolean;
  hasSpeaker: boolean;
  speakerHtml: string;
  speakerTabStyle: React.CSSProperties;
  dialogueHtml: string;
  linePaginationEnabled?: boolean;
  isRevealing?: boolean;
  isAwaitingContinue?: boolean;
  onPlaybackGateChange?: (gate: DialoguePlaybackGate) => void;
  showContinueHint: boolean;
  interactive: boolean;
  onActivate?: () => void;
}) {
  const lineHeight = compact ? 1.25 : 1.6;
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const previousHtmlRef = useRef("");
  const [startLineIndex, setStartLineIndex] = useState(0);
  const startLineIndexRef = useRef(0);
  const [lineOffsets, setLineOffsets] = useState<number[]>([0]);
  const [contentHeight, setContentHeight] = useState(0);
  const [contentViewportHeightPx, setContentViewportHeightPx] = useState(0);
  startLineIndexRef.current = startLineIndex;
  const hintReservePx = dialogueHintReservePx(compact, !compact && showContinueHint);

  useEffect(() => {
    if (shouldResetDialogueLinePage(previousHtmlRef.current, dialogueHtml)) {
      setStartLineIndex(0);
    }
    previousHtmlRef.current = dialogueHtml;
  }, [dialogueHtml]);

  const measureLines = useCallback((lineStart = startLineIndexRef.current) => {
      const measureEl = measureRef.current;
      const viewportEl = viewportRef.current;
      if (!measureEl) return;
      const offsets = measureVisualLineOffsets(measureEl);
      const nextViewportHeight = viewportEl?.clientHeight ?? 0;
      const nextContentViewportHeight = dialogueContentHeightPx(
        nextViewportHeight,
        compact,
        hintReservePx,
      );
      const nextStartLine = clampDialogueStartLine(offsets, lineStart);
      const { linesOnPage: nextLinesOnPage } = getDialoguePageState(
        offsets,
        measureEl.scrollHeight,
        nextStartLine,
        nextContentViewportHeight,
      );
      setLineOffsets(offsets);
      setContentHeight(measureEl.scrollHeight);
      setContentViewportHeightPx(nextContentViewportHeight);
      setStartLineIndex(nextStartLine);
      if (!compact && onPlaybackGateChange) {
        const hasOffscreenLines = nextStartLine + nextLinesOnPage < offsets.length;
        const shouldPausePlayback =
          nextContentViewportHeight > 0 && isRevealing && hasOffscreenLines;
        onPlaybackGateChange({
          totalLines: offsets.length,
          linesOnPage: nextLinesOnPage,
          startLineIndex: nextStartLine,
          hasOffscreenLines,
          shouldPausePlayback,
          measuredForHtmlLength: dialogueHtml.length,
        });
      }
    },
    [compact, dialogueHtml, hintReservePx, isRevealing, onPlaybackGateChange],
  );

  const followTail = isRevealing && !isAwaitingContinue;
  const { scrollTranslate, linesOnPage, hasMoreToPaginate } = getDialoguePageState(
    lineOffsets,
    contentHeight,
    startLineIndex,
    contentViewportHeightPx,
    followTail,
  );

  useLayoutEffect(() => {
    measureLines();
  }, [dialogueHtml, measureLines]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      measureLines();
    });
    observer.observe(viewportEl);
    return () => observer.disconnect();
  }, [measureLines]);
  const canPaginate = linePaginationEnabled && hasMoreToPaginate;
  const showMoreHint = canPaginate || isAwaitingContinue;
  const showInlineMoreHint = !compact && showMoreHint && !showContinueHint;
  const displayDialogueHtml = showInlineMoreHint
    ? appendInlineDialogueMoreHint(dialogueHtml)
    : dialogueHtml;
  const canInteract =
    !compact && (interactive || canPaginate || isAwaitingContinue || !!onActivate);

  const handleActivate = () => {
    if (isAwaitingContinue) {
      if (isRevealing) {
        const nextStart = startLineIndex + linesOnPage;
        setStartLineIndex(nextStart);
        measureLines(nextStart);
      }
      onActivate?.();
      return;
    }
    if (canPaginate) {
      const nextStart = startLineIndex + linesOnPage;
      setStartLineIndex(nextStart);
      measureLines(nextStart);
      return;
    }
    onActivate?.();
  };

  return (
    <div
      style={{
        alignSelf: "stretch",
        ...(canInteract && {
          cursor: "pointer",
          userSelect: "none",
        }),
      }}
      {...(canInteract && {
        onClick: () => handleActivate(),
        role: "button",
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleActivate();
          }
        },
      })}
    >
      {hasSpeaker && (
        <div style={speakerTabStyle}>
          <div dangerouslySetInnerHTML={{ __html: speakerHtml }} />
        </div>
      )}
      <div style={vnDialogueBoxChromeStyle(compact)}>
        <div
          ref={viewportRef}
          style={{
            ...vnDialogueScrollStyle(compact, hintReservePx),
            lineHeight,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            ref={measureRef}
            aria-hidden
            style={{
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
              top: compact ? 0 : 2,
              right: compact ? 0 : 6,
              left: compact ? 0 : 6,
              height: "auto",
              lineHeight,
            }}
            dangerouslySetInnerHTML={{ __html: dialogueHtml }}
          />
          <div
            style={{
              flexShrink: 0,
              ...(scrollTranslate > 0 && {
                transform: `translateY(${scrollTranslate}px)`,
              }),
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: displayDialogueHtml }} />
          </div>
        </div>
        {showContinueHint && (
          <div style={vnDialogueHintCornerStyle(compact)}>
            <DialogueCaptionHint compact={compact} />
          </div>
        )}
      </div>
    </div>
  );
}
