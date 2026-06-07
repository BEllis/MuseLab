import { useProjectStore } from "@/store/projectStore";
import { CloseButton } from "../CloseButton";

export function EdgeEditorPanel() {
  const selectedEdgeIds = useProjectStore((s) => s.selectedEdgeIds);
  const project = useProjectStore((s) => s.project);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const updateEdge = useProjectStore((s) => s.updateEdge);

  const edge =
    selectedEdgeIds.length === 1
      ? project.edges.find((e) => e.id === selectedEdgeIds[0])
      : null;

  if (!edge) return null;

  const sourceLabel = project.nodes.find((n) => n.id === edge.sourceNodeId)?.label ?? edge.sourceNodeId;
  const targetLabel = project.nodes.find((n) => n.id === edge.targetNodeId)?.label ?? edge.targetNodeId;

  return (
    <div
      style={{
        width: "320px",
        borderLeft: "1px solid var(--app-border)",
        padding: "12px",
        background: "var(--app-surface-muted)",
        overflowY: "auto",
        maxHeight: "100vh",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <strong>Link</strong>
        <CloseButton onClick={() => clearSelection()} />
      </div>
      <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--app-text-muted)" }}>
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
