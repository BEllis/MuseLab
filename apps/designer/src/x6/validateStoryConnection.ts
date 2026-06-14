import type { StoryNode } from "@/core/model/types";
import { isJumpNode, isSceneNode, isStartNode } from "@/core/model/nodeTypes";
import { FREE_IN_PORT, isEndNodeId, isOutPort } from "./constants";

export type ValidateStoryConnectionInput = {
  sourceNodeId: string;
  targetNodeId?: string | null;
  sourcePort: string | null;
  targetPort: string | null;
  lookupNode: (nodeId: string) => StoryNode | null;
};

/** Pure graph connection rules shared by the X6 editor and tests. */
export function validateStoryConnection(input: ValidateStoryConnectionInput): boolean {
  const { sourceNodeId, targetNodeId, sourcePort, targetPort, lookupNode } = input;

  if (!isOutPort(sourcePort)) return false;

  const sourceNode = lookupNode(sourceNodeId);
  if (!sourceNode || (!isStartNode(sourceNode) && !isSceneNode(sourceNode))) {
    return false;
  }

  if (!targetNodeId) return true;

  if (sourceNodeId === targetNodeId) return false;
  if (isEndNodeId(sourceNodeId) || isEndNodeId(targetNodeId)) return false;

  if (targetPort !== FREE_IN_PORT) return false;

  const targetNode = lookupNode(targetNodeId);
  if (!targetNode) return false;

  if (!isSceneNode(targetNode) && !isJumpNode(targetNode)) return false;

  return true;
}
