import type { Project, StoryNode, StoryEdge, Asset } from "./types";
import { getPlayEntryNodeId } from "./graphHierarchy";
import {
  DEFAULT_BACKDROP_ID,
  ensureDefaultBackdrop,
  isDefaultBackdrop,
  resolveBackdropId,
} from "../assets/defaultBackdrop";

/** Create a new empty project */
export function createEmptyProject(name: string = "Untitled"): Project {
  const project: Project = {
    name,
    assets: [],
    nodes: [],
    edges: [],
    globalState: {},
  };
  ensureDefaultBackdrop(project);
  return project;
}

/** Blank slate for File → New: default backdrop asset and one empty scene. */
export function createStarterProject(name: string = "Untitled"): Project {
  const project = createEmptyProject(name);
  addNode(project, { x: 100, y: 100 });
  return project;
}

/** Generate a unique id (simple nanoid-style) */
function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/** Add a node to the project; returns the new node */
export function addNode(project: Project, position?: { x: number; y: number }): StoryNode {
  ensureDefaultBackdrop(project);
  const id = generateId();
  const node: StoryNode = {
    id,
    position: position ?? { x: 0, y: 0 },
    backdropId: DEFAULT_BACKDROP_ID,
    actorIds: [],
    soundConfigs: [],
    textTemplate: "",
  };
  project.nodes.push(node);
  return node;
}

/** Duplicate a node with a new id; does not copy edges. */
export function cloneNode(
  project: Project,
  nodeId: string,
  position: { x: number; y: number }
): StoryNode | null {
  const source = project.nodes.find((n) => n.id === nodeId);
  if (!source) return null;

  ensureDefaultBackdrop(project);
  const id = generateId();
  const node: StoryNode = {
    id,
    position,
    label: source.label,
    backdropId: resolveBackdropId(project, source.backdropId),
    actorIds: [...source.actorIds],
    soundConfigs: source.soundConfigs.map((config) => ({ ...config })),
    textTemplate: source.textTemplate,
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
  if (!node) return;
  if ("backdropId" in patch) {
    patch = { ...patch, backdropId: resolveBackdropId(project, patch.backdropId) };
  }
  Object.assign(node, patch);
}

/** Add an edge between two nodes */
export function addEdge(
  project: Project,
  sourceNodeId: string,
  targetNodeId: string,
  options?: {
    id?: string;
    optionText?: string;
    condition?: string;
    sourcePortId?: string | null;
    targetPortId?: string | null;
  }
): StoryEdge {
  const id = options?.id ?? generateId();
  const existing = project.edges.find((edge) => edge.id === id);
  if (existing) return existing;

  const edge: StoryEdge = {
    id,
    sourceNodeId,
    targetNodeId,
    sourcePortId: resolveNewEdgeSourcePort(id, options?.sourcePortId),
    targetPortId: resolveNewEdgeTargetPort(),
    optionText: options?.optionText,
    condition: options?.condition,
  };
  project.edges.push(edge);
  return edge;
}

const FREE_OUT_PORT = "__free_out__";
const FREE_IN_PORT = "__free_in__";

function resolveNewEdgeSourcePort(edgeId: string, portId?: string | null): string {
  if (portId && portId !== FREE_OUT_PORT && portId.startsWith("out-")) {
    return portId;
  }
  return `out-${edgeId}`;
}

function resolveNewEdgeTargetPort(): string {
  return FREE_IN_PORT;
}

/** All incoming edges use the single shared in port id. */
export function normalizeEdgeTargetPorts(project: Project): void {
  for (const edge of project.edges) {
    edge.targetPortId = FREE_IN_PORT;
  }
}

/** Remove an edge */
export function removeEdge(project: Project, edgeId: string): void {
  project.edges = project.edges.filter((e) => e.id !== edgeId);
}

/** Update edge (option text, condition) */
export function updateEdge(
  project: Project,
  edgeId: string,
  patch: Partial<Pick<StoryEdge, "optionText" | "condition" | "vertices" | "manualRoute">>
): void {
  const edge = project.edges.find((e) => e.id === edgeId);
  if (!edge) return;
  Object.assign(edge, patch);
  if ("vertices" in patch && patch.vertices === undefined) {
    delete edge.vertices;
  }
  if ("manualRoute" in patch && patch.manualRoute === undefined) {
    delete edge.manualRoute;
  }
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
  if (!asset) return;
  if (isDefaultBackdrop(assetId)) {
    asset.name = "default";
    return;
  }
  Object.assign(asset, patch);
}

/** Replace asset media in place; id and node references stay the same. */
export function replaceAssetMedia(
  project: Project,
  assetId: string,
  options: { path?: string; blobStored?: boolean }
): void {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return;

  delete asset.imageData;
  delete asset.imageMimeType;
  delete asset.url;

  if (options.path) {
    asset.path = options.path;
    delete asset.blobStored;
  } else {
    delete asset.path;
    if (options.blobStored) {
      asset.blobStored = true;
    } else {
      delete asset.blobStored;
    }
  }
}

/** Remove an asset (caller should ensure no nodes reference it) */
export function removeAsset(project: Project, assetId: string): void {
  if (isDefaultBackdrop(assetId)) return;
  project.assets = project.assets.filter((a) => a.id !== assetId);
  ensureDefaultBackdrop(project);
}

/** Starting scene: the sole node with no incoming edges, if unambiguous. */
export function getEntryNodeId(project: Project): string | null {
  return getPlayEntryNodeId(project);
}

/** Update top-level project fields. */
export function updateProject(
  project: Project,
  patch: Partial<Pick<Project, "name" | "entryNodeId" | "globalState" | "thumbnailAspectRatio" | "playerResolution">>
): void {
  if (patch.name !== undefined) {
    project.name = patch.name;
  }
  if (patch.entryNodeId !== undefined) {
    project.entryNodeId = patch.entryNodeId || undefined;
  }
  if (patch.globalState !== undefined) {
    project.globalState = patch.globalState;
  }
  if (patch.thumbnailAspectRatio !== undefined) {
    project.thumbnailAspectRatio = patch.thumbnailAspectRatio;
  }
  if (patch.playerResolution !== undefined) {
    project.playerResolution = patch.playerResolution;
  }
}

/** Serialize project to JSON string (in-memory shape; actor blobs may be omitted). */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/** Serialize project manifest for persistence (assets stored separately in MLVN archives). */
export function serializeProjectForSave(project: Project): string {
  return serializeProject(project);
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
  ensureDefaultBackdrop(data);
  normalizeEdgeTargetPorts(data);
  return data;
}
