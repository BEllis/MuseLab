import type { Project, StoryNode, StoryEdge, Asset } from "./types";

/** Create a new empty project */
export function createEmptyProject(name: string = "Untitled"): Project {
  return {
    name,
    assets: [],
    nodes: [],
    edges: [],
    globalState: {},
  };
}

/** Generate a unique id (simple nanoid-style) */
function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/** Add a node to the project; returns the new node */
export function addNode(project: Project, position?: { x: number; y: number }): StoryNode {
  const id = generateId();
  const node: StoryNode = {
    id,
    position: position ?? { x: 0, y: 0 },
    backdropId: null,
    actorIds: [],
    soundConfigs: [],
    textTemplate: "",
  };
  project.nodes.push(node);
  return node;
}

/** Remove a node and all edges connected to it */
export function removeNode(project: Project, nodeId: string): void {
  project.nodes = project.nodes.filter((n) => n.id !== nodeId);
  project.edges = project.edges.filter(
    (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
  );
}

/** Update node position (e.g. after drag) */
export function updateNodePosition(
  project: Project,
  nodeId: string,
  position: { x: number; y: number }
): void {
  const node = project.nodes.find((n) => n.id === nodeId);
  if (node) node.position = position;
}

/** Update a node's fields (partial) */
export function updateNode(
  project: Project,
  nodeId: string,
  patch: Partial<Omit<StoryNode, "id">>
): void {
  const node = project.nodes.find((n) => n.id === nodeId);
  if (node) Object.assign(node, patch);
}

/** Add an edge between two nodes */
export function addEdge(
  project: Project,
  sourceNodeId: string,
  targetNodeId: string,
  options?: { sourceHandle?: string; targetHandle?: string; optionText?: string; condition?: string }
): StoryEdge {
  const id = generateId();
  const edge: StoryEdge = {
    id,
    sourceNodeId,
    targetNodeId,
    sourceHandle: options?.sourceHandle,
    targetHandle: options?.targetHandle,
    optionText: options?.optionText,
    condition: options?.condition,
  };
  project.edges.push(edge);
  return edge;
}

/** Remove an edge */
export function removeEdge(project: Project, edgeId: string): void {
  project.edges = project.edges.filter((e) => e.id !== edgeId);
}

/** Update edge (option text, condition) */
export function updateEdge(
  project: Project,
  edgeId: string,
  patch: Partial<Pick<StoryEdge, "optionText" | "condition" | "sourceHandle" | "targetHandle">>
): void {
  const edge = project.edges.find((e) => e.id === edgeId);
  if (edge) Object.assign(edge, patch);
}

/** Add an asset; returns the new asset */
export function addAsset(
  project: Project,
  type: Asset["type"],
  name: string,
  options: { path?: string; url?: string }
): Asset {
  const id = generateId();
  const asset: Asset = {
    id,
    type,
    name,
    path: options.path,
    url: options.url,
  };
  project.assets.push(asset);
  return asset;
}

/** Update an asset (e.g. rename) */
export function updateAsset(
  project: Project,
  assetId: string,
  patch: Partial<Pick<Asset, "name">>
): void {
  const asset = project.assets.find((a) => a.id === assetId);
  if (asset) Object.assign(asset, patch);
}

/** Remove an asset (caller should ensure no nodes reference it) */
export function removeAsset(project: Project, assetId: string): void {
  project.assets = project.assets.filter((a) => a.id !== assetId);
}

/** Get entry node id: explicit entry or first node */
export function getEntryNodeId(project: Project): string | null {
  if (project.entryNodeId && project.nodes.some((n) => n.id === project.entryNodeId))
    return project.entryNodeId;
  return project.nodes[0]?.id ?? null;
}

/** Serialize project to JSON string */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/** Parse project from JSON string */
export function parseProject(json: string): Project {
  const data = JSON.parse(json) as Project;
  if (
    !data.name ||
    !Array.isArray(data.assets) ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.edges)
  ) {
    throw new Error("Invalid project JSON");
  }
  data.globalState = data.globalState ?? {};
  return data;
}
