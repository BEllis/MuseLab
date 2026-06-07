import { useLayoutEffect, useRef } from "react";
import type { Node } from "@antv/x6";
import { useProjectStore } from "@/store/projectStore";
import { useDesignerStore } from "@/store/designerStore";
import { SceneStagePreview } from "@/components/SceneStagePreview";
import { DEFAULT_BACKDROP_ID } from "@/core/assets/defaultBackdrop";

export type StoryNodeData = {
  label?: string;
  preview?: string;
  selected?: boolean;
  invalidRoot?: boolean;
  backdropId?: string;
  assetDropTarget?: boolean;
};

export function StoryNodeView({ node }: { node: Node }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const project = useProjectStore((s) => s.project);
  const thumbnailAspectRatio = useDesignerStore((s) => s.thumbnailAspectRatio);
  const data = node.getData<StoryNodeData>();

  const domainNode = project.nodes.find((n) => n.id === node.id);
  const label = data?.label ?? domainNode?.label ?? "Scene";
  const selected = data?.selected ?? false;
  const invalidRoot = data?.invalidRoot ?? false;
  const assetDropTarget = data?.assetDropTarget ?? false;

  const stageNode = domainNode ?? {
    id: node.id,
    backdropId: data?.backdropId ?? DEFAULT_BACKDROP_ID,
    actorIds: [] as string[],
    textTemplate: data?.preview ?? "",
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

  const borderColor = invalidRoot
    ? "var(--app-node-invalid-border)"
    : assetDropTarget
      ? "var(--app-accent-border)"
      : "var(--app-accent)";

  return (
    <div
      ref={rootRef}
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
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontWeight: 600, marginBottom: "6px" }}>
        {label || "(unnamed)"}
      </div>
      <SceneStagePreview
        project={project}
        node={stageNode}
        variant="compact"
        thumbnailAspectRatio={thumbnailAspectRatio}
        style={{
          borderRadius: "6px",
        }}
      />
    </div>
  );
}
