/** Node with at least id and position (e.g. StoryNode from project) */
export interface NodeWithPosition {
  id: string;
  position: { x: number; y: number };
}

export const DEFAULT_NODE_WIDTH = 200;
export const DEFAULT_NODE_HEIGHT = 80;
export const MIN_NODE_GAP = 24;

export interface NodeSize {
  width: number;
  height: number;
}

const defaultNodeSize: NodeSize = {
  width: DEFAULT_NODE_WIDTH,
  height: DEFAULT_NODE_HEIGHT,
};

function getNodeBounds(
  position: { x: number; y: number },
  size: NodeSize
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: position.x,
    top: position.y,
    right: position.x + size.width,
    bottom: position.y + size.height,
  };
}

function boundsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
  gap: number
): boolean {
  return (
    a.left < b.right + gap &&
    a.right + gap > b.left &&
    a.top < b.bottom + gap &&
    a.bottom + gap > b.top
  );
}

/**
 * Returns true if a node at `position` overlaps any other node in `allNodes` (excluding the node with `nodeId`).
 * Uses the same box size for all nodes for consistency.
 */
export function doesNodeOverlapOthers(
  nodeId: string,
  position: { x: number; y: number },
  allNodes: NodeWithPosition[],
  nodeSize: NodeSize = defaultNodeSize,
  gap: number = MIN_NODE_GAP
): boolean {
  const bounds = getNodeBounds(position, nodeSize);
  for (const n of allNodes) {
    if (n.id === nodeId) continue;
    const other = getNodeBounds(n.position, nodeSize);
    if (boundsOverlap(bounds, other, gap)) return true;
  }
  return false;
}

/**
 * If the node at `position` overlaps any other node, returns a new position so it no longer overlaps.
 * Uses a nudge-right-then-down strategy to find a free spot.
 * Otherwise returns the original position.
 */
export function findNonOverlappingPosition(
  nodeId: string,
  position: { x: number; y: number },
  allNodes: NodeWithPosition[],
  nodeSize: NodeSize = defaultNodeSize,
  gap: number = MIN_NODE_GAP
): { x: number; y: number } {
  if (!doesNodeOverlapOthers(nodeId, position, allNodes, nodeSize, gap)) {
    return position;
  }
  const step = nodeSize.height + gap;
  for (let dy = 0; dy <= step * 20; dy += step) {
    for (let dx = 0; dx <= step * 20; dx += step) {
      if (dx === 0 && dy === 0) continue;
      const candidate = { x: position.x + dx, y: position.y + dy };
      if (!doesNodeOverlapOthers(nodeId, candidate, allNodes, nodeSize, gap)) {
        return candidate;
      }
    }
  }
  for (let dy = 0; dy >= -step * 20; dy -= step) {
    for (let dx = 0; dx >= -step * 20; dx -= step) {
      if (dx === 0 && dy === 0) continue;
      const candidate = { x: position.x + dx, y: position.y + dy };
      if (!doesNodeOverlapOthers(nodeId, candidate, allNodes, nodeSize, gap)) {
        return candidate;
      }
    }
  }
  return position;
}
