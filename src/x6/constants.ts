export const STORY_NODE_SHAPE = "story-node";
export const START_NODE_SHAPE = "start-arrow";
export const JUMP_NODE_SHAPE = "jump-arrow";
export const END_NODE_SHAPE = "end-circle";
export const STORY_EDGE_SHAPE = "story-edge";

export const END_NODE_ID_PREFIX = "end:";

export function isEndNodeId(id: string): boolean {
  return id.startsWith(END_NODE_ID_PREFIX);
}

export function endNodeIdForScene(sceneId: string): string {
  return `${END_NODE_ID_PREFIX}${sceneId}`;
}

export function sceneIdFromEndNodeId(endNodeId: string): string | null {
  if (!isEndNodeId(endNodeId)) return null;
  return endNodeId.slice(END_NODE_ID_PREFIX.length);
}

export function isSyntheticEndEdgeId(edgeId: string): boolean {
  return edgeId.startsWith(`${END_NODE_ID_PREFIX}edge:`);
}

/** Unconnected out port used to start a new edge (right side). */
export const FREE_OUT_PORT = "__free_out__";
/** Unconnected in port used to receive a new edge (left side). */
export const FREE_IN_PORT = "__free_in__";

export function sourcePortId(edgeId: string): string {
  return `out-${edgeId}`;
}

export function targetPortId(edgeId: string): string {
  return `in-${edgeId}`;
}

export function isFreePort(portId: string | null | undefined): boolean {
  return portId === FREE_OUT_PORT || portId === FREE_IN_PORT;
}

export function isOutPort(portId: string | null | undefined): boolean {
  return portId === FREE_OUT_PORT || (portId?.startsWith("out-") ?? false);
}

export function isInPort(portId: string | null | undefined): boolean {
  return portId === FREE_IN_PORT;
}

/** X6 puts `port` on the port wrapper; the magnet circle is usually a child. */
export function magnetPortId(magnet: Element): string | null {
  return (
    magnet.getAttribute("port") ??
    magnet.closest("[port]")?.getAttribute("port") ??
    null
  );
}
