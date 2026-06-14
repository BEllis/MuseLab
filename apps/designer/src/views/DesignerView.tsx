import { useCallback, useEffect, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { AssetEditorPanel } from "@/components/AssetEditor/AssetEditorPanel";
import { NodeEditorPanel } from "@/components/NodeEditor/NodeEditorPanel";
import { EdgeEditorPanel } from "@/components/EdgeEditor/EdgeEditorPanel";
import { ModuleEditorPanel } from "@/components/ModuleEditor/ModuleEditorPanel";
import { StoryEditorPanel } from "@/components/StoryEditor/StoryEditorPanel";
import { InspectorPanelShell } from "@/components/InspectorPanelShell";
import { LeftPanel } from "@/components/LeftPanel";
import { useProjectStore } from "@/store/projectStore";
import { useSceneEditorPreviewStore } from "@/store/sceneEditorPreviewStore";

function useSingleSelectionInspector():
  | { kind: "asset" }
  | { kind: "module" }
  | { kind: "story" }
  | { kind: "node" }
  | { kind: "edge" }
  | null {
  const selectedAssetId = useProjectStore((s) => s.selectedAssetId);
  const selectedModuleId = useProjectStore((s) => s.selectedModuleId);
  const selectedStoryId = useProjectStore((s) => s.selectedStoryId);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);

  if (selectedModuleId) {
    return { kind: "module" };
  }
  if (selectedAssetId) {
    return { kind: "asset" };
  }
  if (selectedStoryId) {
    return { kind: "story" };
  }
  if (selectedNodeIds.length === 1 && selectedEdgeIds.length === 0) {
    return { kind: "node" };
  }
  if (selectedEdgeIds.length === 1 && selectedNodeIds.length === 0) {
    return { kind: "edge" };
  }
  return null;
}

export default function DesignerView() {
  const inspector = useSingleSelectionInspector();
  const hidePreview = useSceneEditorPreviewStore((s) => s.hidePreview);
  const editingTemplate = useSceneEditorPreviewStore((s) => s.editingTemplate);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);

  useEffect(() => {
    if (inspector?.kind !== "node") {
      hidePreview();
    }
  }, [inspector?.kind, hidePreview]);

  useEffect(() => {
    if (!inspector) {
      setInspectorExpanded(false);
    }
  }, [inspector]);

  const toggleInspectorExpanded = useCallback(() => {
    setInspectorExpanded((expanded) => {
      if (!expanded) {
        hidePreview();
      }
      return !expanded;
    });
  }, [hidePreview]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <LeftPanel />
      {(!inspectorExpanded || editingTemplate) && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <FlowCanvas />
        </div>
      )}
      {inspector && !editingTemplate && (
        <InspectorPanelShell
          expanded={inspectorExpanded}
          onToggleExpanded={toggleInspectorExpanded}
        >
          {inspector.kind === "module" && <ModuleEditorPanel />}
          {inspector.kind === "asset" && <AssetEditorPanel />}
          {inspector.kind === "story" && <StoryEditorPanel />}
          {inspector.kind === "node" && <NodeEditorPanel />}
          {inspector.kind === "edge" && <EdgeEditorPanel />}
        </InspectorPanelShell>
      )}
    </div>
  );
}
