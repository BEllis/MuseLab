const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 160;
const START_X = 200;
const START_Y = 100;
const START_NODE_OFFSET_X = -180;

export function assignScenePositions(
  sceneIds: string[],
  edges: Array<{ source: string; target: string }>,
  entrySceneId: string
): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const queue = [entrySceneId];
  depth.set(entrySceneId, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const currentDepth = depth.get(id) ?? 0;
    for (const edge of edges) {
      if (edge.source !== id || !sceneIds.includes(edge.target) || depth.has(edge.target)) {
        continue;
      }
      depth.set(edge.target, currentDepth + 1);
      queue.push(edge.target);
    }
  }

  const byDepth = new Map<number, string[]>();
  for (const id of sceneIds) {
    const d = depth.get(id) ?? 0;
    const bucket = byDepth.get(d) ?? [];
    bucket.push(id);
    byDepth.set(d, bucket);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const [d, ids] of byDepth) {
    ids.forEach((id, row) => {
      positions[id] = {
        x: START_X + d * COLUMN_WIDTH,
        y: START_Y + row * ROW_HEIGHT,
      };
    });
  }
  return positions;
}

export function assignStartNodePosition(entryScenePosition: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: entryScenePosition.x + START_NODE_OFFSET_X,
    y: entryScenePosition.y,
  };
}
