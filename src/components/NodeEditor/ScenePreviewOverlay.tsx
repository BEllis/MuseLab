import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { TemplateTextEditor } from "@/components/NodeEditor/TemplateTextEditor";
import { getDefaultLocale, getNodeTextTemplateForLocale } from "@/core/locale/prompts";
import { renderNodePreviewHtml } from "@/core/view/sceneStage";
import {
  fitAspectRatioInBox,
  getProjectThumbnailAspectRatio,
} from "@/core/view/thumbnailAspectRatio";

const GRAPH_PREVIEW_INSET = 16;
const EDITOR_DOCK_HEIGHT_RATIO = 0.4;
const EDITOR_TEXT_MIN_HEIGHT = 200;
const EDITOR_TEXT_MAX_HEIGHT = 360;

export function ScenePreviewOverlay() {
  const open = useSceneEditorPreviewStore((s) => s.open);
  const previewLocale = useSceneEditorPreviewStore((s) => s.locale);
  const draftTemplate = useSceneEditorPreviewStore((s) => s.draftTemplate);
  const editingTemplate = useSceneEditorPreviewStore((s) => s.editingTemplate);
  const hidePreview = useSceneEditorPreviewStore((s) => s.hidePreview);
  const updateDraftTemplate = useSceneEditorPreviewStore((s) => s.updateDraftTemplate);

  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const updateNodePrompt = useProjectStore((s) => s.updateNodePrompt);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
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
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);

  const [dialogueHtml, setDialogueHtml] = useState<string | undefined>(undefined);

  const committedTemplate =
    draftTemplate ??
    (node ? getNodeTextTemplateForLocale(promptsByLocale, locale, storyId, node.id) : "");

  useEffect(() => {
    if (!editingTemplate && draftTemplate === undefined) {
      setDialogueHtml(undefined);
      return;
    }
    let cancelled = false;
    void renderNodePreviewHtml(committedTemplate, story.globalState, { project }).then((html) => {
      if (!cancelled) setDialogueHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [committedTemplate, draftTemplate, editingTemplate, story.globalState, project]);

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

  const stopEditorClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

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
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
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
            value={committedTemplate}
            onChange={handleTemplateChange}
            onDraftChange={handleDraftChange}
            onBlurCommit={() => flushHistoryCoalesce()}
            syncKey={`${node.id}:${locale}`}
            soundAssets={sounds}
            minHeight={EDITOR_TEXT_MIN_HEIGHT}
            maxHeight={EDITOR_TEXT_MAX_HEIGHT}
            placeholder='Hello world… Use the toolbar for Format.* tags, or {{ rt.GetString("key") }} for logic.'
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
