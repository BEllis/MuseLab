import { useProjectStore } from "@/store/projectStore";
import { CloseButton } from "../CloseButton";

export function EdgeEditorPanel() {
  const selectedEdgeId = useProjectStore((s) => s.selectedEdgeId);
  const project = useProjectStore((s) => s.project);
  const setSelectedEdgeId = useProjectStore((s) => s.setSelectedEdgeId);
  const updateEdge = useProjectStore((s) => s.updateEdge);

  const edge = selectedEdgeId
    ? project.edges.find((e) => e.id === selectedEdgeId)
    : null;

  if (!edge) return null;

  const sourceLabel = project.nodes.find((n) => n.id === edge.sourceNodeId)?.label ?? edge.sourceNodeId;
  const targetLabel = project.nodes.find((n) => n.id === edge.targetNodeId)?.label ?? edge.targetNodeId;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "12px 16px",
        minWidth: "320px",
        maxWidth: "90vw",
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <strong>Link</strong>
        <CloseButton onClick={() => setSelectedEdgeId(null)} />
      </div>
      <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#666" }}>
        {sourceLabel} → {targetLabel}
      </p>
      <label style={{ display: "block", marginBottom: "8px" }}>
        Option text (shown as player choice; leave empty for auto-advance)
        <input
          type="text"
          value={edge.optionText ?? ""}
          onChange={(e) => updateEdge(edge.id, { optionText: e.target.value || undefined })}
          placeholder="e.g. Go left"
          style={{ display: "block", width: "100%", marginTop: "4px", padding: "6px" }}
        />
      </label>
      <label style={{ display: "block" }}>
        Condition (TypeScript expression; leave empty to always show)
        <textarea
          value={edge.condition ?? ""}
          onChange={(e) => updateEdge(edge.id, { condition: e.target.value || undefined })}
          placeholder="e.g. state.visitedForest"
          rows={2}
          style={{
            display: "block",
            width: "100%",
            marginTop: "4px",
            padding: "6px",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        />
      </label>
    </div>
  );
}
