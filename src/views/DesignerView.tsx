import { FlowCanvas } from "@/components/FlowCanvas";
import { NodeEditorPanel } from "@/components/NodeEditor/NodeEditorPanel";
import { EdgeEditorPanel } from "@/components/EdgeEditor/EdgeEditorPanel";
import { AssetsPanel } from "@/components/AssetsPanel";

export default function DesignerView() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      <AssetsPanel />
      <div style={{ flex: 1, minWidth: 0 }}>
        <FlowCanvas />
      </div>
      <NodeEditorPanel />
      <EdgeEditorPanel />
    </div>
  );
}
