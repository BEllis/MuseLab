import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { TemplateTextEditor } from "@/components/NodeEditor/TemplateTextEditor";
import {
  EditorPreviewSoundPlayer,
  useEditorPreviewSoundPlayer,
} from "@/components/NodeEditor/EditorPreviewSoundPlayer";
import {
  getDefaultLocale,
  getNodeSpeakerForLocale,
  getNodeTextTemplateForLocale,
} from "@/core/locale/prompts";
import type { PromptInstruction } from "@/core/prompt/promptInstructions";
import { renderNodePreviewResult } from "@/core/view/sceneStage";
import {
  wrapStoryPromptTemplate,
  wrapStorySpeakerTemplate,
} from "@/core/template/storyTemplateWrap";
import {
  computeStagePreviewScale,
  getProjectPlayerResolution,
} from "@/core/view/playerResolution";

const GRAPH_PREVIEW_INSET = 16;
const EDITOR_DOCK_HEIGHT_RATIO = 0.4;
const EDITOR_TEXT_MIN_HEIGHT = 200;
const EDITOR_TEXT_MAX_HEIGHT = 360;
const EDITOR_PREVIEW_DEBOUNCE_MS = 400;

type EditorPreviewRender = {
  dialogueHtml: string;
  dialogueSpeaker: string;
  promptInstructions: PromptInstruction[];
};

export function ScenePreviewOverlay() {
  const open = useSceneEditorPreviewStore((s) => s.open);
  const previewLocale = useSceneEditorPreviewStore((s) => s.locale);
  const draftTemplate = useSceneEditorPreviewStore((s) => s.draftTemplate);
  const editingTemplate = useSceneEditorPreviewStore((s) => s.editingTemplate);
  const hidePreview = useSceneEditorPreviewStore((s) => s.hidePreview);
  const updateDraftTemplate = useSceneEditorPreviewStore((s) => s.updateDraftTemplate);

  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const eventLogCursor = useProjectStore((s) => s.eventLog.cursor);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const updateNodePrompt = useProjectStore((s) => s.updateNodePrompt);
  const updateNodeSpeaker = useProjectStore((s) => s.updateNodeSpeaker);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
  const switchEditorLocale = useSceneEditorPreviewStore((s) => s.switchEditorLocale);
  const { story, storyId } = useActiveStory();

  const node =
    selectedNodeIds.length === 1
      ? story.nodes.find((n) => n.id === selectedNodeIds[0])
      : null;

  const locale = previewLocale ?? getDefaultLocale(project);
  const playerResolution = getProjectPlayerResolution(project);
  const sounds = project.assets
    .filter((a) => a.type === "sound")
    .map((a) => ({ id: a.id, name: a.name }));

  const containerRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const editorPreviewImmediateRef = useRef(true);
  const [previewFrame, setPreviewFrame] = useState<{
    scale: number;
    scaledWidth: number;
    scaledHeight: number;
  } | null>(null);

  const [editorPreviewRender, setEditorPreviewRender] = useState<EditorPreviewRender | null>(null);
  const [playbackKey, setPlaybackKey] = useState(0);
  const {
    playSound,
    stopAll,
    onDemandAssetIds,
    handleAudioReady,
    handleAudioUnmount,
  } = useEditorPreviewSoundPlayer(project);

  const storeTemplate = node
    ? getNodeTextTemplateForLocale(promptsByLocale, locale, storyId, node.id)
    : "";
  const previewTemplate = draftTemplate ?? storeTemplate;

  const speaker = node
    ? getNodeSpeakerForLocale(promptsByLocale, locale, storyId, node.id)
    : "";

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
      editingTemplate && !editorPreviewImmediateRef.current ? EDITOR_PREVIEW_DEBOUNCE_MS : 0;
    if (editingTemplate) {
      editorPreviewImmediateRef.current = false;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        const templateResult = await renderNodePreviewResult(
          wrapStoryPromptTemplate(story, previewTemplate),
          story.globalState,
          { project }
        );
        const speakerResult = speaker
          ? await renderNodePreviewResult(
              wrapStorySpeakerTemplate(story, speaker),
              story.globalState,
              { project }
            )
          : { html: "", instructions: [] };
        if (cancelled) return;
        setEditorPreviewRender({
          dialogueHtml: templateResult.html,
          promptInstructions: templateResult.instructions,
          dialogueSpeaker: speakerResult.html,
        });
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    node,
    previewTemplate,
    speaker,
    editingTemplate,
    story.globalState,
    story.promptStartTemplate,
    story.promptEndTemplate,
    story.speakerStartTemplate,
    story.speakerEndTemplate,
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

  const handleTemplateChange = useCallback(
    (markup: string) => {
      if (!node) return;
      updateNodePrompt(locale, node.id, markup, {
        mergeKey: `node-text:${node.id}:${locale}`,
      });
    },
    [locale, node, updateNodePrompt]
  );

  const handleDraftChange = useCallback(
    (draft: string) => {
      updateDraftTemplate(draft);
    },
    [updateDraftTemplate]
  );

  const handleSpeakerChange = useCallback(
    (speaker: string) => {
      if (!node) return;
      updateNodeSpeaker(locale, node.id, speaker, {
        mergeKey: `node-speaker:${node.id}:${locale}`,
      });
    },
    [locale, node, updateNodeSpeaker]
  );

  const handleLocaleChange = useCallback(
    (nextLocale: string) => {
      if (!node || nextLocale === locale) return;
      if (draftTemplate !== undefined) {
        updateNodePrompt(locale, node.id, draftTemplate, {
          mergeKey: `node-text:${node.id}:${locale}`,
        });
      }
      flushHistoryCoalesce();
      const freshPrompts = useProjectStore.getState().promptsByLocale;
      switchEditorLocale(
        nextLocale,
        getNodeTextTemplateForLocale(freshPrompts, nextLocale, storyId, node.id)
      );
    },
    [draftTemplate, flushHistoryCoalesce, locale, node, storyId, switchEditorLocale, updateNodePrompt]
  );

  const stopEditorClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleRestartPreview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      stopAll();
      setPlaybackKey((key) => key + 1);
    },
    [stopAll]
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
        cursor: editingTemplate ? undefined : "pointer",
      }}
      onClick={editingTemplate ? undefined : hidePreview}
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

      {editingTemplate && (
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
          <TemplateTextEditor
            value={storeTemplate}
            onChange={handleTemplateChange}
            onDraftChange={handleDraftChange}
            onBlurCommit={() => flushHistoryCoalesce()}
            syncKey={`${node.id}:${locale}:${eventLogCursor}`}
            project={project}
            soundAssets={sounds}
            speaker={speaker}
            onSpeakerChange={handleSpeakerChange}
            locale={locale}
            locales={project.locales}
            onLocaleChange={handleLocaleChange}
            minHeight={EDITOR_TEXT_MIN_HEIGHT}
            maxHeight={EDITOR_TEXT_MAX_HEIGHT}
            placeholder='Hello world… Use the toolbar for Format.* tags, or @rt.GetString("key") for logic.'
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
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
