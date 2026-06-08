import { useLayoutEffect, useRef } from "react";
import type { Node } from "@antv/x6";
import { useProjectStore } from "@/store/projectStore";
import { useActiveStory } from "@/hooks/useActiveStory";
import { getProjectThumbnailAspectRatio } from "@/core/view/thumbnailAspectRatio";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { DEFAULT_BACKDROP_ID } from "@/core/assets/defaultBackdrop";
import { getNodeDisplayName } from "@/core/model/nodeNames";
import type { ActorSceneConfig } from "@/core/model/types";

export type StoryNodeData = {
  type?: "start" | "scene" | "jump";
  label?: string;
  preview?: string;
  selected?: boolean;
  invalidRoot?: boolean;
  backdropId?: string;
  assetDropTarget?: boolean;
  jumpTargetSummary?: string;
};

function SceneNodeBody({
  label,
  selected,
  invalidRoot,
  assetDropTarget,
  stageNode,
  project,
  story,
  storyId,
  promptsByLocale,
  thumbnailAspectRatio,
}: {
  label: string;
  selected: boolean;
  invalidRoot: boolean;
  assetDropTarget: boolean;
  stageNode: { id: string; backdropId: string; actorConfigs: ActorSceneConfig[] };
  project: ReturnType<typeof useProjectStore.getState>["project"];
  story: ReturnType<typeof useActiveStory>["story"];
  storyId: string;
  promptsByLocale: ReturnType<typeof useProjectStore.getState>["promptsByLocale"];
  thumbnailAspectRatio: ReturnType<typeof getProjectThumbnailAspectRatio>;
}) {
  const borderColor = invalidRoot
    ? "var(--app-node-invalid-border)"
    : assetDropTarget
      ? "var(--app-accent-border)"
      : "var(--app-accent)";

  return (
    <div
      style={{
        padding: "12px 16px",
        minWidth: "160px",
        border: `3px solid ${borderColor}`,
        borderRadius: "8px",
        background: invalidRoot
          ? "var(--app-node-invalid-bg)"
          : selected
            ? "var(--app-node-selected-bg)"
            : "var(--app-node-bg)",
        color: "var(--app-text)",
        boxShadow: invalidRoot
          ? "0 0 0 2px rgba(220, 38, 38, 0.25), 0 2px 8px var(--app-shadow)"
          : assetDropTarget
            ? "0 0 0 2px var(--app-accent-border), 0 2px 8px var(--app-shadow)"
            : "0 2px 8px var(--app-shadow)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "6px" }}>{label}</div>
      <SceneStagePreview
        project={project}
        story={story}
        storyId={storyId}
        promptsByLocale={promptsByLocale}
        node={stageNode}
        variant="compact"
        disableShake
        thumbnailAspectRatio={thumbnailAspectRatio}
        style={{ borderRadius: "6px" }}
      />
    </div>
  );
}

export function StoryNodeView({ node }: { node: Node }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const project = useProjectStore((s) => s.project);
  const promptsByLocale = useProjectStore((s) => s.promptsByLocale);
  const { story, storyId } = useActiveStory();
  const thumbnailAspectRatio = getProjectThumbnailAspectRatio(project);
  const data = node.getData<StoryNodeData>();

  const domainNode = story.nodes.find((n) => n.id === node.id);
  const label = data?.label ?? (domainNode ? getNodeDisplayName(domainNode) : "Scene");
  const selected = data?.selected ?? false;
  const invalidRoot = data?.invalidRoot ?? false;
  const assetDropTarget = data?.assetDropTarget ?? false;

  const stageNode = {
    id: node.id,
    backdropId: domainNode?.backdropId ?? data?.backdropId ?? DEFAULT_BACKDROP_ID,
    actorConfigs: domainNode?.actorConfigs ?? [],
  };

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const width = Math.max(el.offsetWidth, 160);
    const height = Math.max(el.offsetHeight, 40);
    const size = node.getSize();
    if (
      Math.abs(size.width - width) > 1 ||
      Math.abs(size.height - height) > 1
    ) {
      node.resize(width, height);
    }
  });

  return (
    <div ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <SceneNodeBody
        label={label}
        selected={selected}
        invalidRoot={invalidRoot}
        assetDropTarget={assetDropTarget}
        stageNode={stageNode}
        project={project}
        story={story}
        storyId={storyId}
        promptsByLocale={promptsByLocale}
        thumbnailAspectRatio={thumbnailAspectRatio}
      />
    </div>
  );
}
