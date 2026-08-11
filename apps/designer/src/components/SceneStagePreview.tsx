// @refresh reset
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Project, Story, StoryNode } from "@/core/model/types";
import type { PromptInstruction } from "@/core/prompt/promptInstructions";
import type { SceneOp } from "@/core/scene/sceneOps";
import {
  PromptInstructionExecutor,
  shouldUsePromptExecutor,
} from "@/components/PromptInstructionExecutor";
import { useLoadedFonts } from "@/hooks/useLoadedFonts";
import { StageLayers } from "@/components/StageLayers";
import {
  getNodeChoices,
  hasVisibleRichText,
  renderScenePreviewResultForLocale,
  type SceneStageChoice,
} from "@/core/view/sceneStage";
import { getDefaultLocale, getNodeActionsForLocale, type PromptsByLocale } from "@/core/locale/prompts";
import { summarizeSceneActions } from "@/core/scene/sceneSummary";
import {
  EMPTY_STAGE_VIEW,
  stageViewFromSummary,
  type StageView,
} from "@/core/view/stageView";
import { finalSpeakerHtml } from "@/core/prompt/executePromptInstructions";
import {
  compactVnButtonStyle,
  DIALOGUE_PANEL_FRACTION,
  DIALOGUE_PANEL_HEIGHT,
  compactVnSpeakerTabOverlayStyle,
  compactVnSpeakerTabStyle,
  vnButtonStyle,
  dialogueContentHeightPx,
  dialogueHintReservePx,
  vnDialogueBoxChromeStyle,
  vnDialogueHintCornerStyle,
  vnDialogueScrollStyle,
  vnDialogueTextContainerStyle,
  vnSpeakerTabStyle,
} from "@/core/view/vnStyles";
import {
  aspectRatioToCss,
  letterboxContentRect,
  STAGE_CONTENT_ASPECT_RATIO,
  type LetterboxContentRect,
} from "@/core/view/thumbnailAspectRatio";
import {
  appendInlineDialogueMoreHint,
  clampDialogueStartLine,
  getDialoguePageState,
  getLastPageStartLine,
  measureVisualLineOffsets,
  shouldResetDialogueLinePage,
} from "@/core/view/dialogueLinePagination";

type SceneStagePreviewProps = {
  project: Project;
  story: Story;
  storyId: string;
  promptsByLocale: PromptsByLocale;
  node: Pick<StoryNode, "id">;
  locale?: string;
  variant?: "compact" | "full";
  dialogueHtml?: string;
  dialogueSpeaker?: string;
  /** Live stage state during playback; falls back to the scene's end state. */
  stageView?: StageView;
  onSceneOp?: (op: SceneOp) => Promise<void> | void;
  onDialogueBoundary?: () => void;
  promptInstructions?: PromptInstruction[];
  onPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
  choices?: SceneStageChoice[];
  singleChoice?: boolean;
  showContinue?: boolean;
  onChoice?: (targetNodeId: string) => void;
  onContinue?: () => void;
  onRestart?: () => void;
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
  stageView,
  onSceneOp,
  onDialogueBoundary,
  promptInstructions = [],
  onPlaySound,
  choices: choicesProp,
  singleChoice: singleChoiceProp,
  showContinue = false,
  onChoice,
  onContinue,
  onRestart,
  disableShake = false,
  style,
}: SceneStagePreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [contentRect, setContentRect] = useState<LetterboxContentRect | null>(null);
  const activeLocale = locale ?? getDefaultLocale(project);
  const staticStageView = useMemo(() => {
    if (stageView) return EMPTY_STAGE_VIEW;
    const actions = getNodeActionsForLocale(promptsByLocale, activeLocale, storyId, node.id);
    return stageViewFromSummary(summarizeSceneActions(actions));
  }, [stageView, promptsByLocale, activeLocale, storyId, node.id]);
  const resolvedStageView = stageView ?? staticStageView;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      setContentRect(letterboxContentRect(el.clientWidth, el.clientHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [previewHtml, setPreviewHtml] = useState(dialogueHtml ?? "");
  const [previewSpeaker, setPreviewSpeaker] = useState(dialogueSpeaker ?? "");
  const [previewChoices, setPreviewChoices] = useState<SceneStageChoice[]>(choicesProp ?? []);
  const [promptComplete, setPromptComplete] = useState(true);

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
    if (dialogueHtml !== undefined && dialogueSpeaker !== undefined) {
      setPreviewHtml(dialogueHtml);
      setPreviewSpeaker(dialogueSpeaker);
      return;
    }
    let cancelled = false;
    void renderScenePreviewResultForLocale(
      story,
      storyId,
      project,
      promptsByLocale,
      node.id,
      locale,
      { disableShake }
    ).then((result) => {
      if (cancelled) return;
      setPreviewHtml(result.html);
      setPreviewSpeaker(finalSpeakerHtml(result.instructions, ""));
    });
    return () => {
      cancelled = true;
    };
  }, [
    dialogueHtml,
    dialogueSpeaker,
    story,
    storyId,
    project,
    promptsByLocale,
    node.id,
    locale,
    disableShake,
  ]);

  const html = dialogueHtml ?? previewHtml;
  const { defaultFontFamily } = useLoadedFonts(project, html);
  const initialSpeakerHtml = dialogueSpeaker ?? previewSpeaker;
  const choices = choicesProp ?? previewChoices;
  const hasDialogueContent = hasVisibleRichText(html) || hasVisibleRichText(initialSpeakerHtml);
  const hasOptions = choices.some((choice) => choice.optionText);
  const compact = variant === "compact";
  const usePromptExecutor =
    !compact && shouldUsePromptExecutor(promptInstructions);
  const interactionsEnabled = compact || promptComplete;
  const singleChoice = singleChoiceProp ?? (choices.length === 1 && !hasOptions);
  const hasChoiceButtons = choices.length > 0 && !singleChoice;
  const showChoiceButtons = hasChoiceButtons && interactionsEnabled;
  const continueOnClick = showContinue && !compact && interactionsEnabled;
  const handlePromptComplete = useCallback(() => {
    setPromptComplete(true);
  }, []);

  const handlePromptSkipChange = useCallback((skipped: boolean) => {
    if (skipped) setPromptComplete(true);
  }, []);

  useEffect(() => {
    setPromptComplete(!usePromptExecutor);
  }, [html, promptInstructions, usePromptExecutor]);
  const dialogueVisible = resolvedStageView.dialogueVisible;
  const showCaptionPanel = dialogueVisible && hasDialogueContent;
  const choiceAreaBottom =
    showCaptionPanel && showChoiceButtons
      ? compact
        ? `${DIALOGUE_PANEL_FRACTION * 100}%`
        : DIALOGUE_PANEL_HEIGHT
      : 0;
  const needsStageContinue =
    !compact &&
    !hasDialogueContent &&
    interactionsEnabled &&
    (singleChoice || showContinue) &&
    !hasChoiceButtons;

  const buttonStyle = compact ? compactVnButtonStyle : vnButtonStyle;
  const speakerTabStyle = compact ? compactVnSpeakerTabStyle : vnSpeakerTabStyle;
  const stageFrameStyle: React.CSSProperties = contentRect
    ? {
        position: "absolute",
        left: contentRect.left,
        top: contentRect.top,
        width: contentRect.width,
        height: contentRect.height,
        overflow: "hidden",
        background: "#0a0a12",
      }
    : {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#0a0a12",
      };

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: compact ? aspectRatioToCss(STAGE_CONTENT_ASPECT_RATIO) : undefined,
        height: compact ? undefined : "100%",
        overflow: "hidden",
        background: "#000",
        ...style,
      }}
    >
      <div style={stageFrameStyle}>
        <div style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
          <StageLayers project={project} view={resolvedStageView} />
        </div>

        {showChoiceButtons && (
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
            data-dialogue-character={resolvedStageView.dialogueCharacterId || undefined}
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: `${resolvedStageView.dialogueWidthPercent}%`,
              height: compact ? `${DIALOGUE_PANEL_FRACTION * 100}%` : DIALOGUE_PANEL_HEIGHT,
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: compact ? "3px 4px 4px" : "16px 24px 24px",
              pointerEvents: compact ? "none" : undefined,
            }}
          >
            {usePromptExecutor ? (
              <PromptInstructionExecutor
                fullHtml={html}
                initialSpeakerHtml={initialSpeakerHtml}
                instructions={promptInstructions}
                onPlaySound={onPlaySound}
                onSceneOp={onSceneOp}
                onDialogueBoundary={onDialogueBoundary}
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
                    defaultFontFamily={defaultFontFamily}
                    dialogueHtml={visibleHtml}
                    linePaginationEnabled={!compact && !isComplete}
                    playbackInProgress={!isComplete}
                    isRevealing={!isComplete && isRevealing}
                    isAwaitingContinue={!isComplete && isAwaitingContinue}
                    showContinueHint={
                      (!compact && isAwaitingContinue) ||
                      ((singleChoice || (showContinue && !compact && isComplete)) &&
                        isComplete &&
                        !hasChoiceButtons)
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
                defaultFontFamily={defaultFontFamily}
                dialogueHtml={html}
                linePaginationEnabled={interactionsEnabled}
                showContinueHint={
                  (singleChoice || continueOnClick) && interactionsEnabled && !hasChoiceButtons
                }
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

            {!compact && choices.length === 0 && !showContinue && onRestart && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
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
              </div>
            )}
          </div>
        )}
      </div>
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
  defaultFontFamily,
  dialogueHtml,
  linePaginationEnabled = true,
  playbackInProgress = false,
  isRevealing = false,
  isAwaitingContinue = false,
  showContinueHint,
  interactive,
  onActivate,
}: {
  compact: boolean;
  hasSpeaker: boolean;
  speakerHtml: string;
  speakerTabStyle: React.CSSProperties;
  defaultFontFamily?: string;
  dialogueHtml: string;
  linePaginationEnabled?: boolean;
  playbackInProgress?: boolean;
  isRevealing?: boolean;
  isAwaitingContinue?: boolean;
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
  const prevIsRevealingRef = useRef(false);
  startLineIndexRef.current = startLineIndex;
  const hintReservePx = dialogueHintReservePx(compact, !compact && showContinueHint);

  useEffect(() => {
    if (!isRevealing) {
      prevIsRevealingRef.current = false;
    }
  }, [isRevealing]);

  useEffect(() => {
    if (shouldResetDialogueLinePage(previousHtmlRef.current, dialogueHtml)) {
      setStartLineIndex(0);
    }
    previousHtmlRef.current = dialogueHtml;
  }, [dialogueHtml]);

  const measureLines = useCallback((explicitLineStart?: number) => {
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
      const revealJustStarted = isRevealing && !prevIsRevealingRef.current;
      let nextStartLine: number;
      if (explicitLineStart !== undefined) {
        nextStartLine = clampDialogueStartLine(offsets, explicitLineStart);
      } else if (revealJustStarted && nextContentViewportHeight > 0) {
        nextStartLine = getLastPageStartLine(
          offsets,
          measureEl.scrollHeight,
          nextContentViewportHeight,
          0,
        );
      } else {
        nextStartLine = clampDialogueStartLine(offsets, startLineIndexRef.current);
      }
      if (isRevealing) {
        prevIsRevealingRef.current = true;
      }
      getDialoguePageState(
        offsets,
        measureEl.scrollHeight,
        nextStartLine,
        nextContentViewportHeight,
      );
      setLineOffsets(offsets);
      setContentHeight(measureEl.scrollHeight);
      setContentViewportHeightPx(nextContentViewportHeight);
      setStartLineIndex(nextStartLine);
    },
    [compact, dialogueHtml, hintReservePx, isRevealing],
  );

  const { linesOnPage, hasMoreToPaginate } = getDialoguePageState(
    lineOffsets,
    contentHeight,
    startLineIndex,
    contentViewportHeightPx,
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
  const showInlineMoreHint = !compact && canPaginate && !showContinueHint;
  const displayDialogueHtml = showInlineMoreHint
    ? appendInlineDialogueMoreHint(dialogueHtml)
    : dialogueHtml;
  const canInteract =
    !compact && (interactive || canPaginate || isAwaitingContinue || !!onActivate);

  const handleActivate = () => {
    if (isAwaitingContinue) {
      if (playbackInProgress) {
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

  const speakerOverlayStyle = compact && hasSpeaker ? compactVnSpeakerTabOverlayStyle() : speakerTabStyle;

  return (
    <div
      style={{
        alignSelf: "stretch",
        ...(compact && hasSpeaker && { position: "relative" }),
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
      {hasSpeaker && !compact && (
        <div style={speakerTabStyle}>
          <div dangerouslySetInnerHTML={{ __html: speakerHtml }} />
        </div>
      )}
      <div
        style={{
          ...vnDialogueBoxChromeStyle(compact),
          ...(hasSpeaker && { borderTop: "none" }),
        }}
      >
        <div
          ref={viewportRef}
          style={{
            ...vnDialogueScrollStyle(compact, hintReservePx),
            lineHeight,
            ...(defaultFontFamily ? { fontFamily: defaultFontFamily } : {}),
          }}
        >
          <div
            ref={measureRef as React.RefObject<HTMLDivElement>}
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
          <div style={vnDialogueTextContainerStyle(contentViewportHeightPx)}>
            <div dangerouslySetInnerHTML={{ __html: displayDialogueHtml }} />
          </div>
        </div>
        {showContinueHint && (
          <div style={vnDialogueHintCornerStyle(compact)}>
            <DialogueCaptionHint compact={compact} />
          </div>
        )}
      </div>
      {hasSpeaker && compact && (
        <div style={speakerOverlayStyle}>
          <div dangerouslySetInnerHTML={{ __html: speakerHtml }} />
        </div>
      )}
    </div>
  );
}
