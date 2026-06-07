import { FlowCanvas } from "@/components/FlowCanvas";
import { AssetEditorPanel } from "@/components/AssetEditor/AssetEditorPanel";
import { NodeEditorPanel } from "@/components/NodeEditor/NodeEditorPanel";
import { EdgeEditorPanel } from "@/components/EdgeEditor/EdgeEditorPanel";
import { LeftPanel } from "@/components/LeftPanel";
import { useProjectStore } from "@/store/projectStore";

function useSingleSelectionInspector():
  | { kind: "asset" }
  | { kind: "node" }
  | { kind: "edge" }
  | null {
  const selectedAssetId = useProjectStore((s) => s.selectedAssetId);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);

  if (selectedAssetId) {
    return { kind: "asset" };
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

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <LeftPanel />
      <div style={{ flex: 1, minWidth: 0 }}>
        <FlowCanvas />
      </div>
      {inspector?.kind === "asset" && <AssetEditorPanel />}
      {inspector?.kind === "node" && <NodeEditorPanel />}
      {inspector?.kind === "edge" && <EdgeEditorPanel />}
    </div>
  );
}
