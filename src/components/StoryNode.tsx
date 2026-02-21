import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useProjectStore } from "@/store/projectStore";
import { useAssetUrl } from "@/hooks/useAssetUrl";

const HANDLES_PER_SIDE = 10;
const BORDER_HANDLES = HANDLES_PER_SIDE * 4;
const BORDER_HANDLE_SIZE = 24;

/** Evenly spaced along each side so the whole border can start an edge */
function buildBorderHandleLayout(): { position: Position; style: React.CSSProperties }[] {
  const layout: { position: Position; style: React.CSSProperties }[] = [];
  const positions = Array.from(
    { length: HANDLES_PER_SIDE },
    (_, i) => ((i + 1) / (HANDLES_PER_SIDE + 1)) * 100
  );
  positions.forEach((p) => {
    layout.push(
      { position: Position.Right, style: { right: 0, top: `${p}%`, transform: "translate(50%, -50%)" } },
      { position: Position.Bottom, style: { bottom: 0, left: `${p}%`, transform: "translate(-50%, 50%)" } },
      { position: Position.Left, style: { left: 0, top: `${p}%`, transform: "translate(-50%, -50%)" } },
      { position: Position.Top, style: { top: 0, left: `${p}%`, transform: "translate(-50%, -50%)" } }
    );
  });
  return layout;
}
const BORDER_HANDLE_LAYOUT = buildBorderHandleLayout();

export const StoryNode = memo(function StoryNode({ id, data, selected }: NodeProps) {
  const project = useProjectStore((s) => s.project);
  const node = project.nodes.find((n) => n.id === id);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);

  const label = data?.label ?? node?.label ?? "Scene";
  const preview = (data?.preview as string) ?? "";
  const backdropUrl = useAssetUrl(project, node?.backdropId ?? null);

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 16px",
        minWidth: "160px",
        border: "3px solid #4a90d9",
        borderRadius: "8px",
        background: selected ? "#e8e8f0" : "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
      onClick={() => setSelectedNodeId?.(id)}
      title="Drag from the border to create a connection; drop on a node to connect"
    >
      {/* Whole node as target: full-size transparent handle so any drop on the node connects */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          minWidth: 40,
          minHeight: 40,
          background: "transparent",
          border: "none",
          borderRadius: "inherit",
          transform: "none",
          opacity: 0,
          zIndex: 5,
        }}
        isConnectableStart={false}
        isConnectableEnd
      />
      <div style={{ position: "relative", zIndex: 1, fontWeight: 600, marginBottom: "4px" }}>
        {label || "(unnamed)"}
      </div>
      {backdropUrl && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxHeight: "120px",
            marginBottom: "8px",
            borderRadius: "6px",
            overflow: "hidden",
            background: "#eee",
          }}
        >
          <img
            src={backdropUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              maxHeight: "120px",
              objectFit: "cover",
              display: "block",
              verticalAlign: "top",
            }}
          />
        </div>
      )}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: "12px",
          color: "#666",
          maxWidth: "200px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {preview || "—"}
      </div>
      {/* Whole border as source: invisible handles along all four sides */}
      {BORDER_HANDLE_LAYOUT.slice(0, BORDER_HANDLES).map((layout, i) => (
        <Handle
          key={`source-${i}`}
          id={`source-${i}`}
          type="source"
          position={layout.position}
          style={{
            ...layout.style,
            position: "absolute",
            width: BORDER_HANDLE_SIZE,
            height: BORDER_HANDLE_SIZE,
            opacity: 0,
            zIndex: 10,
          }}
          isConnectableStart
          isConnectableEnd={false}
        />
      ))}
    </div>
  );
});
