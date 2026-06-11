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
import { renderNodePreviewHtml, renderNodePreviewResult } from "@/core/view/sceneStage";
import {
  fitAspectRatioInBox,
  getProjectThumbnailAspectRatio,
} from "@/core/view/thumbnailAspectRatio";

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
  const thumbnailAspectRatio = getProjectThumbnailAspectRatio(project);
  const sounds = project.assets
    .filter((a) => a.type === "sound")
    .map((a) => ({ id: a.id, name: a.name }));

  const containerRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const editorPreviewImmediateRef = useRef(true);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);

  const [dialogueHtml, setDialogueHtml] = useState<string | undefined>(undefined);
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
    if (!editingTemplate && draftTemplate === undefined) {
      setDialogueHtml(undefined);
      return;
    }
    if (editingTemplate) return;

    let cancelled = false;
    void renderNodePreviewHtml(previewTemplate, story.globalState, { project }).then((html) => {
      if (!cancelled) setDialogueHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [previewTemplate, draftTemplate, editingTemplate, story.globalState, project]);

  useEffect(() => {
    editorPreviewImmediateRef.current = true;
  }, [locale]);

  useEffect(() => {
    if (!editingTemplate) {
      editorPreviewImmediateRef.current = true;
      setEditorPreviewRender(null);
      return;
    }

    let cancelled = false;
    const delay = editorPreviewImmediateRef.current ? 0 : EDITOR_PREVIEW_DEBOUNCE_MS;
    editorPreviewImmediateRef.current = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const templateResult = await renderNodePreviewResult(
          previewTemplate,
          story.globalState,
          { project }
        );
        const speakerResult = speaker
          ? await renderNodePreviewResult(speaker, story.globalState, { project })
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
  }, [previewTemplate, speaker, editingTemplate, story.globalState, project, locale]);

  useEffect(() => {
    if (!open) {
      setPreviewSize(null);
      return;
    }

    const el = editingTemplate ? previewAreaRef.current : containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const availableWidth = el.clientWidth - GRAPH_PREVIEW_INSET * 2;
      const availableHeight = el.clientHeight - GRAPH_PREVIEW_INSET * 2;
      setPreviewSize(fitAspectRatioInBox(availableWidth, availableHeight, thumbnailAspectRatio));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, thumbnailAspectRatio, editingTemplate]);

  useEffect(() => {
    if (!open || !editingTemplate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hidePreview();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, editingTemplate, hidePreview]);

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

  if (editingTemplate) {
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
        }}
        onClick={hidePreview}
      >
        <div
          ref={previewAreaRef}
          onClick={stopEditorClick}
          onMouseDown={stopEditorClick}
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {previewSize && previewSize.width > 0 && previewSize.height > 0 && editorPreviewRender && (
            <div
              style={{
                position: "relative",
                width: previewSize.width,
                height: previewSize.height,
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 8px 32px var(--app-shadow)",
              }}
            >
              <button
                type="button"
                onClick={handleRestartPreview}
                title="Restart prompt playback"
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
                Restart
              </button>
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
                style={{ width: "100%", height: "100%" }}
              />
              <EditorPreviewSoundPlayer
                project={project}
                assetIds={onDemandAssetIds}
                onReady={handleAudioReady}
                onUnmount={handleAudioUnmount}
              />
            </div>
          )}
        </div>

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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom: "8px",
              flexShrink: 0,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
                minWidth: 0,
                fontSize: "13px",
              }}
            >
              <span style={{ color: "var(--app-text-muted)", flexShrink: 0 }}>Speaker</span>
              <input
                type="text"
                value={speaker}
                onChange={(e) => handleSpeakerChange(e.target.value)}
                placeholder="Optional — supports Cito"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "6px 8px",
                  fontSize: "13px",
                  border: "1px solid var(--app-border)",
                  borderRadius: "4px",
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "var(--app-text-muted)" }}>Locale</span>
              <select
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value)}
                style={{
                  padding: "6px 8px",
                  fontSize: "13px",
                  border: "1px solid var(--app-border)",
                  borderRadius: "4px",
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                }}
              >
                {project.locales.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <TemplateTextEditor
            value={storeTemplate}
            onChange={handleTemplateChange}
            onDraftChange={handleDraftChange}
            onBlurCommit={() => flushHistoryCoalesce()}
            syncKey={`${node.id}:${locale}:${eventLogCursor}`}
            project={project}
            soundAssets={sounds}
            minHeight={EDITOR_TEXT_MIN_HEIGHT}
            maxHeight={EDITOR_TEXT_MAX_HEIGHT}
            placeholder='Hello world… Use the toolbar for Format.* tags, or @rt.GetString("key") for logic.'
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              type="button"
              onClick={hidePreview}
              style={{
                padding: "6px 16px",
                border: "1px solid var(--app-border)",
                borderRadius: "6px",
                background: "var(--app-surface-hover)",
                color: "var(--app-text)",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="presentation"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--app-overlay)",
        cursor: "pointer",
      }}
      onClick={hidePreview}
    >
      {previewSize && previewSize.width > 0 && previewSize.height > 0 && (
        <div
          style={{
            width: previewSize.width,
            height: previewSize.height,
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 8px 32px var(--app-shadow)",
          }}
        >
          <SceneStagePreview
            project={project}
            story={story}
            storyId={storyId}
            promptsByLocale={promptsByLocale}
            node={node}
            locale={locale}
            variant="full"
            dialogueHtml={dialogueHtml}
            disableShake
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
