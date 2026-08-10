import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { ActionPillEditor } from "@/components/NodeEditor/ActionPillEditor";
import {
  EditorPreviewSoundPlayer,
  useEditorPreviewSoundPlayer,
} from "@/components/NodeEditor/EditorPreviewSoundPlayer";
import { getDefaultLocale, getNodeActionsForLocale } from "@/core/locale/prompts";
import type { PromptInstruction } from "@/core/prompt/promptInstructions";
import { finalSpeakerHtml } from "@/core/prompt/executePromptInstructions";
import { renderScenePreviewResult } from "@/core/view/sceneStage";
import { useSceneDirector } from "@/hooks/useSceneDirector";
import {
  computeStagePreviewScale,
  getProjectPlayerResolution,
} from "@/core/view/playerResolution";

const GRAPH_PREVIEW_INSET = 16;
const EDITOR_DOCK_HEIGHT_RATIO = 0.4;
const EDITOR_PREVIEW_DEBOUNCE_MS = 400;

type EditorPreviewRender = {
  dialogueHtml: string;
  dialogueSpeaker: string;
  promptInstructions: PromptInstruction[];
};

export function ScenePreviewOverlay() {
  const open = useSceneEditorPreviewStore((s) => s.open);
  const previewLocale = useSceneEditorPreviewStore((s) => s.locale);
  const editingActions = useSceneEditorPreviewStore((s) => s.editingActions);
  const hidePreview = useSceneEditorPreviewStore((s) => s.hidePreview);
  const switchEditorLocale = useSceneEditorPreviewStore((s) => s.switchEditorLocale);

  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const updateNodeActions = useProjectStore((s) => s.updateNodeActions);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
  const { story, storyId } = useActiveStory();

  const node =
    selectedNodeIds.length === 1
      ? story.nodes.find((n) => n.id === selectedNodeIds[0])
      : null;

  const locale = previewLocale ?? getDefaultLocale(project);
  const playerResolution = getProjectPlayerResolution(project);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const editorPreviewImmediateRef = useRef(true);
  const [previewFrame, setPreviewFrame] = useState<{
    scale: number;
    scaledWidth: number;
    scaledHeight: number;
  } | null>(null);

  const [editorPreviewRender, setEditorPreviewRender] = useState<EditorPreviewRender | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [playbackKey, setPlaybackKey] = useState(0);
  const {
    playSound,
    stopAll,
    onDemandAssetIds,
    handleAudioReady,
    handleAudioUnmount,
  } = useEditorPreviewSoundPlayer(project);
  const { stageView, applySceneOp, dialogueBoundary, reset } = useSceneDirector();

  const actions = node ? getNodeActionsForLocale(promptsByLocale, locale, storyId, node.id) : [];
  const actionsKey = JSON.stringify(actions);

  useEffect(() => {
    editorPreviewImmediateRef.current = true;
  }, [locale]);

  useEffect(() => {
    if (!open || !node) {
      setEditorPreviewRender(null);
      return;
    }

    let cancelled = false;
    const delay =
      editingActions && !editorPreviewImmediateRef.current ? EDITOR_PREVIEW_DEBOUNCE_MS : 0;
    if (editingActions) {
      editorPreviewImmediateRef.current = false;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await renderScenePreviewResult(story, actions, { project });
          if (cancelled) return;
          setPreviewError(null);
          setEditorPreviewRender({
            dialogueHtml: result.html,
            promptInstructions: result.instructions,
            dialogueSpeaker: finalSpeakerHtml(result.instructions, ""),
          });
        } catch (error) {
          if (cancelled) return;
          setPreviewError(error instanceof Error ? error.message : String(error));
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    node,
    actionsKey,
    editingActions,
    story,
    project,
    locale,
  ]);

  useEffect(() => {
    if (!open) {
      setPreviewFrame(null);
      return;
    }

    const el = previewAreaRef.current;
    if (!el) return;

    const updateSize = () => {
      const availableWidth = el.clientWidth - GRAPH_PREVIEW_INSET * 2;
      const availableHeight = el.clientHeight - GRAPH_PREVIEW_INSET * 2;
      const next = computeStagePreviewScale(
        availableWidth,
        availableHeight,
        playerResolution,
      );
      setPreviewFrame((prev) => {
        if (
          prev &&
          prev.scale === next.scale &&
          prev.scaledWidth === next.scaledWidth &&
          prev.scaledHeight === next.scaledHeight
        ) {
          return prev;
        }
        return next;
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, playerResolution.height, playerResolution.width]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hidePreview();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, hidePreview]);

  const handleActionsChange = useCallback(
    (next: Parameters<typeof updateNodeActions>[2]) => {
      if (!node) return;
      updateNodeActions(locale, node.id, next, {
        mergeKey: `node-actions:${node.id}:${locale}`,
      });
    },
    [locale, node, updateNodeActions]
  );

  const handleLocaleChange = useCallback(
    (nextLocale: string) => {
      if (!node || nextLocale === locale) return;
      flushHistoryCoalesce();
      switchEditorLocale(nextLocale);
    },
    [flushHistoryCoalesce, locale, node, switchEditorLocale]
  );

  const stopEditorClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleRestartPreview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      stopAll();
      reset();
      setPlaybackKey((key) => key + 1);
    },
    [reset, stopAll]
  );

  if (!open || !node) return null;

  return (
    <div
      ref={containerRef}
      role="presentation"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        background: "var(--app-overlay)",
        cursor: editingActions ? undefined : "pointer",
      }}
      onClick={editingActions ? undefined : hidePreview}
    >
      <div
        ref={previewAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {previewFrame &&
          previewFrame.scale > 0 &&
          previewFrame.scaledWidth > 0 &&
          previewFrame.scaledHeight > 0 &&
          editorPreviewRender && (
          <div
            onClick={stopEditorClick}
            onMouseDown={stopEditorClick}
            style={{
              position: "relative",
              width: previewFrame.scaledWidth,
              height: previewFrame.scaledHeight,
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 8px 32px var(--app-shadow)",
            }}
          >
            <button
              type="button"
              onClick={handleRestartPreview}
              title="Replay scene playback"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 3,
                padding: "6px 12px",
                border: "1px solid var(--app-border)",
                borderRadius: "6px",
                background: "rgba(0, 0, 0, 0.72)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Replay Scene
            </button>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: playerResolution.width,
                height: playerResolution.height,
                transform: `scale(${previewFrame.scale})`,
                transformOrigin: "top left",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <SceneStagePreview
                key={`${node.id}:${locale}:${playbackKey}`}
                project={project}
                story={story}
                storyId={storyId}
                promptsByLocale={promptsByLocale}
                node={node}
                locale={locale}
                variant="full"
                dialogueHtml={editorPreviewRender.dialogueHtml}
                dialogueSpeaker={editorPreviewRender.dialogueSpeaker}
                promptInstructions={editorPreviewRender.promptInstructions}
                stageView={stageView}
                onSceneOp={applySceneOp}
                onDialogueBoundary={dialogueBoundary}
                onPlaySound={playSound}
                style={{ flex: 1 }}
              />
            </div>
            <EditorPreviewSoundPlayer
              project={project}
              assetIds={onDemandAssetIds}
              onReady={handleAudioReady}
              onUnmount={handleAudioUnmount}
            />
          </div>
        )}
      </div>

      {editingActions && (
        <div
          onClick={stopEditorClick}
          onMouseDown={stopEditorClick}
          style={{
            flexShrink: 0,
            height: `${EDITOR_DOCK_HEIGHT_RATIO * 100}vh`,
            maxHeight: "50vh",
            display: "flex",
            flexDirection: "column",
            padding: "12px 16px 16px",
            background: "var(--app-surface)",
            borderTop: "1px solid var(--app-border)",
            boxShadow: "0 -4px 24px var(--app-shadow)",
          }}
        >
          {previewError && (
            <div
              role="alert"
              style={{
                marginBottom: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #b45309",
                background: "rgba(180, 83, 9, 0.12)",
                color: "var(--app-text)",
                fontSize: "13px",
                lineHeight: 1.4,
              }}
            >
              {previewError}
            </div>
          )}
          <ActionPillEditor
            actions={actions}
            onChange={handleActionsChange}
            onCommit={flushHistoryCoalesce}
            project={project}
            locale={locale}
            onLocaleChange={handleLocaleChange}
            style={{ flex: 1 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              onClick={hidePreview}
              className="app-toolbar-button"
              style={{ padding: "6px 16px", borderRadius: "6px", fontSize: "13px" }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
