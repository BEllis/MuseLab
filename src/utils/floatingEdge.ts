/**
 * Floating edge params: compute edge endpoints on node boundaries
 * (intersection of the line between node centers and each node's rect).
 */

export type Rect = { x: number; y: number; width: number; height: number };

function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/**
 * Intersections of the line segment from lineStart to lineEnd with the rect boundary.
 * Returns up to 2 points with t in [0, 1] (parametric position on segment).
 */
function lineRectIntersections(
  rect: Rect,
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): Array<{ t: number; x: number; y: number }> {
  const { x: rx, y: ry, width: rw, height: rh } = rect;
  const ax = lineStart.x;
  const ay = lineStart.y;
  const bx = lineEnd.x;
  const by = lineEnd.y;
  const dx = bx - ax;
  const dy = by - ay;
  const out: Array<{ t: number; x: number; y: number }> = [];

  const push = (t: number) => {
    if (t >= 0 && t <= 1) {
      out.push({ t, x: ax + t * dx, y: ay + t * dy });
    }
  };

  if (Math.abs(dx) > 1e-10) {
    push((rx - ax) / dx);
    push((rx + rw - ax) / dx);
  }
  if (Math.abs(dy) > 1e-10) {
    push((ry - ay) / dy);
    push((ry + rh - ay) / dy);
  }

  return out.filter((p) => {
    const x = p.x;
    const y = p.y;
    const onX = x >= rx - 1e-6 && x <= rx + rw + 1e-6;
    const onY = y >= ry - 1e-6 && y <= ry + rh + 1e-6;
    return onX && onY;
  });
}

/**
 * Given two node rects, return edge endpoints on the node boundaries:
 * the point where the line (sourceCenter -> targetCenter) exits the source rect,
 * and where it enters the target rect.
 */
export function getFloatingEdgeParams(
  sourceRect: Rect,
  targetRect: Rect
): { sourceX: number; sourceY: number; targetX: number; targetY: number } {
  const sourceCenter = rectCenter(sourceRect);
  const targetCenter = rectCenter(targetRect);

  const sourceHits = lineRectIntersections(
    sourceRect,
    sourceCenter,
    targetCenter
  );
  const targetHits = lineRectIntersections(
    targetRect,
    sourceCenter,
    targetCenter
  );

  const sourceExits = sourceHits.filter((p) => p.t > 1e-6);
  const targetEntries = targetHits.filter((p) => p.t < 1 - 1e-6);
  const sourceExit =
    sourceExits.length > 0
      ? sourceExits.reduce((a, b) => (a.t < b.t ? a : b))
      : sourceCenter;
  const targetEntry =
    targetEntries.length > 0
      ? targetEntries.reduce((a, b) => (a.t > b.t ? a : b))
      : targetCenter;

  return {
    sourceX: sourceExit.x,
    sourceY: sourceExit.y,
    targetX: targetEntry.x,
    targetY: targetEntry.y,
  };
}
