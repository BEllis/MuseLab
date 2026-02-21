import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  Position,
  useStore,
  type EdgeProps,
} from "reactflow";
import { getFloatingEdgeParams } from "@/utils/floatingEdge";

const DEFAULT_CURVATURE = 0.4;

function toRect(
  node:
    | {
        positionAbsolute?: { x: number; y: number };
        width?: number | null;
        height?: number | null;
      }
    | undefined
): { x: number; y: number; width: number; height: number } | null {
  const pa = node?.positionAbsolute;
  const w = node?.width ?? 0;
  const h = node?.height ?? 0;
  if (pa == null || typeof pa.x !== "number" || typeof pa.y !== "number" || w <= 0 || h <= 0)
    return null;
  return { x: pa.x, y: pa.y, width: w, height: h };
}

export const StoryEdge = memo(function StoryEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const nodeRects = useStore((s) => {
    const sn = s.nodeInternals.get(source);
    const tn = s.nodeInternals.get(target);
    return { sourceRect: toRect(sn), targetRect: toRect(tn) };
  });

  const floating =
    nodeRects.sourceRect && nodeRects.targetRect
      ? getFloatingEdgeParams(nodeRects.sourceRect, nodeRects.targetRect)
      : null;

  const sx = floating?.sourceX ?? sourceX;
  const sy = floating?.sourceY ?? sourceY;
  const tx = floating?.targetX ?? targetX;
  const ty = floating?.targetY ?? targetY;

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePosition ?? Position.Right,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPosition ?? Position.Left,
    curvature: DEFAULT_CURVATURE,
  });

  const optionText = (data?.optionText as string) ?? "";

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {optionText && (
        <foreignObject
          x={labelX - 80}
          y={labelY - 12}
          width={160}
          height={24}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div
            style={{
              fontSize: "11px",
              textAlign: "center",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "2px 6px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}
          >
            {optionText}
          </div>
        </foreignObject>
      )}
    </>
  );
});
