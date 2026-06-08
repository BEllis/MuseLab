import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { getDefaultLocale } from "@/core/locale/prompts";
import { renderNodePreviewHtml } from "@/core/view/sceneStage";
import {
  fitAspectRatioInBox,
  getProjectThumbnailAspectRatio,
} from "@/core/view/thumbnailAspectRatio";

const GRAPH_PREVIEW_INSET = 16;

export function ScenePreviewOverlay() {
  const open = useSceneEditorPreviewStore((s) => s.open);
  const previewLocale = useSceneEditorPreviewStore((s) => s.locale);
  const draftTemplate = useSceneEditorPreviewStore((s) => s.draftTemplate);
  const hidePreview = useSceneEditorPreviewStore((s) => s.hidePreview);

  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const { story, storyId } = useActiveStory();

  const node =
    selectedNodeIds.length === 1
      ? story.nodes.find((n) => n.id === selectedNodeIds[0])
      : null;

  const locale = previewLocale ?? getDefaultLocale(project);
  const thumbnailAspectRatio = getProjectThumbnailAspectRatio(project);

  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);

  const [dialogueHtml, setDialogueHtml] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (draftTemplate === undefined) {
      setDialogueHtml(undefined);
      return;
    }
    let cancelled = false;
    void renderNodePreviewHtml(draftTemplate, story.globalState).then((html) => {
      if (!cancelled) setDialogueHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [draftTemplate, story.globalState]);

  useEffect(() => {
    if (!open) {
      setPreviewSize(null);
      return;
    }

    const el = containerRef.current;
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
  }, [open, thumbnailAspectRatio]);

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
