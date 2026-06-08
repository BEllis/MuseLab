import type { Project, Story, StoryNode, StoryEdge, Asset } from "./types";
import { getPlayEntryNodeId } from "./graphHierarchy";
import {
  DEFAULT_BACKDROP_ID,
  ensureDefaultBackdrop,
  isDefaultBackdrop,
  resolveBackdropId,
} from "../assets/defaultBackdrop";
import { assertValidLocaleTag, normalizeLocales } from "../locale/localeTag";
import { MUSELAB_FORMAT_VERSION, STORY_SCHEMA_ID } from "./formatVersion";

/** Generate a unique id (simple nanoid-style) */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function getStory(project: Project, storyId: string): Story {
  const story = project.stories.find((entry) => entry.id === storyId);
  if (!story) {
    throw new Error(`Story "${storyId}" not found`);
  }
  return story;
}

export function getStoryOrNull(project: Project, storyId: string): Story | null {
  return project.stories.find((entry) => entry.id === storyId) ?? null;
}

export function getFirstStoryId(project: Project): string {
  const story = project.stories[0];
  if (!story) {
    throw new Error("Project has no stories");
  }
  return story.id;
}

/** Create a new empty project with one empty story. */
export function createEmptyProject(name: string = "Untitled"): Project {
  const storyId = generateId();
  const project: Project = {
    name,
    assets: [],
    stories: [
      {
        id: storyId,
        name: "Main",
        nodes: [],
        edges: [],
        globalState: {},
      },
    ],
    locales: [...normalizeLocales(undefined)],
  };
  ensureDefaultBackdrop(project);
  return project;
}

/** Blank slate for File → New: default backdrop asset and one empty scene. */
export function createStarterProject(name: string = "Untitled"): Project {
  const project = createEmptyProject(name);
  const storyId = getFirstStoryId(project);
  addNode(project, storyId, { x: 100, y: 100 });
  return project;
}

export function createStarterStory(name: string = "Untitled"): Story {
  const story: Story = {
    id: generateId(),
    name,
    nodes: [],
    edges: [],
    globalState: {},
  };
  addNodeToStory(story, { x: 100, y: 100 });
  return story;
}

export function addStory(project: Project, name?: string): Story {
  const story = createStarterStory(name ?? `Story ${project.stories.length + 1}`);
  project.stories.push(story);
  return story;
}

export function removeStory(project: Project, storyId: string): void {
  if (project.stories.length <= 1) {
    throw new Error("Cannot remove the last story");
  }
  project.stories = project.stories.filter((story) => story.id !== storyId);
}

export function updateStory(
  project: Project,
  storyId: string,
  patch: Partial<Pick<Story, "name" | "entryNodeId" | "globalState">>
): void {
  const story = getStory(project, storyId);
  if (patch.name !== undefined) {
    story.name = patch.name;
  }
  if (patch.entryNodeId !== undefined) {
    story.entryNodeId = patch.entryNodeId || undefined;
  }
  if (patch.globalState !== undefined) {
    story.globalState = patch.globalState;
  }
}

function addNodeToStory(story: Story, position?: { x: number; y: number }): StoryNode {
  const id = generateId();
  const node: StoryNode = {
    id,
    position: position ?? { x: 0, y: 0 },
    backdropId: DEFAULT_BACKDROP_ID,
    actorIds: [],
    soundConfigs: [],
  };
  story.nodes.push(node);
  return node;
}

/** Add a node to a story; returns the new node */
export function addNode(
  project: Project,
  storyId: string,
  position?: { x: number; y: number }
): StoryNode {
  ensureDefaultBackdrop(project);
  return addNodeToStory(getStory(project, storyId), position);
}

/** Duplicate a node with a new id; does not copy edges. */
export function cloneNode(
  project: Project,
  storyId: string,
  nodeId: string,
  position: { x: number; y: number }
): StoryNode | null {
  const story = getStory(project, storyId);
  const source = story.nodes.find((n) => n.id === nodeId);
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
  };
  story.nodes.push(node);
  return node;
}

/** Remove a node and all edges connected to it */
export function removeNode(project: Project, storyId: string, nodeId: string): void {
  const story = getStory(project, storyId);
  story.nodes = story.nodes.filter((n) => n.id !== nodeId);
  story.edges = story.edges.filter(
    (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
  );
}

/** Update node position (e.g. after drag) */
export function updateNodePosition(
  project: Project,
  storyId: string,
  nodeId: string,
  position: { x: number; y: number }
): void {
  const node = getStory(project, storyId).nodes.find((n) => n.id === nodeId);
  if (node) node.position = position;
}

/** Update a node's fields (partial) */
export function updateNode(
  project: Project,
  storyId: string,
  nodeId: string,
  patch: Partial<Omit<StoryNode, "id">>
): void {
  const node = getStory(project, storyId).nodes.find((n) => n.id === nodeId);
  if (!node) return;
  if ("backdropId" in patch) {
    patch = { ...patch, backdropId: resolveBackdropId(project, patch.backdropId) };
  }
  Object.assign(node, patch);
}

/** Add an edge between two nodes */
export function addEdge(
  project: Project,
  storyId: string,
  sourceNodeId: string,
  targetNodeId: string,
  options?: {
    id?: string;
    condition?: string;
    sourcePortId?: string | null;
    targetPortId?: string | null;
  }
): StoryEdge {
  const story = getStory(project, storyId);
  const id = options?.id ?? generateId();
  const existing = story.edges.find((edge) => edge.id === id);
  if (existing) return existing;

  const edge: StoryEdge = {
    id,
    sourceNodeId,
    targetNodeId,
    sourcePortId: resolveNewEdgeSourcePort(id, options?.sourcePortId),
    targetPortId: resolveNewEdgeTargetPort(),
    condition: options?.condition,
  };
  story.edges.push(edge);
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
  for (const story of project.stories) {
    for (const edge of story.edges) {
      edge.targetPortId = FREE_IN_PORT;
    }
  }
}

export function normalizeStoryEdgeTargetPorts(story: Story): void {
  for (const edge of story.edges) {
    edge.targetPortId = FREE_IN_PORT;
  }
}

/** Remove an edge */
export function removeEdge(project: Project, storyId: string, edgeId: string): void {
  const story = getStory(project, storyId);
  story.edges = story.edges.filter((e) => e.id !== edgeId);
}

/** Update edge condition and routing metadata */
export function updateEdge(
  project: Project,
  storyId: string,
  edgeId: string,
  patch: Partial<Pick<StoryEdge, "condition" | "vertices" | "manualRoute">>
): void {
  const edge = getStory(project, storyId).edges.find((e) => e.id === edgeId);
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
export function getEntryNodeId(project: Project, storyId: string): string | null {
  return getPlayEntryNodeId(getStory(project, storyId));
}

/** Update top-level project fields. */
export function updateProject(
  project: Project,
  patch: Partial<
    Pick<Project, "name" | "thumbnailAspectRatio" | "playerResolution" | "locales">
  >
): void {
  if (patch.name !== undefined) {
    project.name = patch.name;
  }
  if (patch.thumbnailAspectRatio !== undefined) {
    project.thumbnailAspectRatio = patch.thumbnailAspectRatio;
  }
  if (patch.playerResolution !== undefined) {
    project.playerResolution = patch.playerResolution;
  }
  if (patch.locales !== undefined) {
    project.locales = normalizeLocales(patch.locales);
  }
}

type LegacyProjectJson = Project & {
  nodes?: StoryNode[];
  edges?: StoryEdge[];
  globalState?: Record<string, unknown>;
  entryNodeId?: string;
  $schema?: string;
  formatVersion?: number;
};

function stripManifestMetadata(data: LegacyProjectJson): LegacyProjectJson {
  const next = { ...data };
  delete next.$schema;
  delete next.formatVersion;
  return next;
}

function toManifestStory(story: Story): Story {
  return {
    id: story.id,
    name: story.name,
    nodes: story.nodes.map((node) => ({
      id: node.id,
      position: node.position,
      label: node.label,
      backdropId: node.backdropId,
      actorIds: node.actorIds,
      soundConfigs: node.soundConfigs,
    })),
    edges: story.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      sourcePortId: edge.sourcePortId,
      targetPortId: edge.targetPortId,
      condition: edge.condition,
      vertices: edge.vertices,
      manualRoute: edge.manualRoute,
    })),
    globalState: story.globalState,
    entryNodeId: story.entryNodeId,
  };
}

function toManifestProject(project: Project): Project {
  return {
    name: project.name,
    assets: project.assets,
    stories: project.stories.map(toManifestStory),
    locales: normalizeLocales(project.locales),
    thumbnailAspectRatio: project.thumbnailAspectRatio,
    playerResolution: project.playerResolution,
  };
}

/** Serialize project manifest to JSON string. */
export function serializeProject(project: Project): string {
  return JSON.stringify(
    {
      $schema: STORY_SCHEMA_ID,
      formatVersion: MUSELAB_FORMAT_VERSION,
      ...toManifestProject(project),
    },
    null,
    2
  );
}

/** Serialize project manifest for persistence (assets stored separately in MLVN archives). */
export function serializeProjectForSave(project: Project): string {
  return serializeProject(project);
}

function migrateLegacyProjectData(data: LegacyProjectJson): Project {
  if (Array.isArray(data.stories) && data.stories.length > 0) {
    return data as Project;
  }

  const storyId = generateId();
  const story: Story = {
    id: storyId,
    name: data.name || "Main",
    nodes: data.nodes ?? [],
    edges: data.edges ?? [],
    globalState: data.globalState ?? {},
    entryNodeId: data.entryNodeId,
  };

  return {
    name: data.name,
    assets: data.assets ?? [],
    stories: [story],
    locales: data.locales ?? [...normalizeLocales(undefined)],
    thumbnailAspectRatio: data.thumbnailAspectRatio,
    playerResolution: data.playerResolution,
  };
}

/** Parse project manifest from JSON string */
export function parseProject(json: string): Project {
  const data = stripManifestMetadata(JSON.parse(json) as LegacyProjectJson);
  const hasStories = Array.isArray(data.stories) && data.stories.length > 0;
  const hasLegacyGraph = Array.isArray(data.nodes) && Array.isArray(data.edges);

  if (!data.name || !Array.isArray(data.assets) || (!hasStories && !hasLegacyGraph)) {
    throw new Error("Invalid project JSON");
  }

  const project = migrateLegacyProjectData(data);
  project.locales = normalizeLocales(project.locales);
  for (const story of project.stories) {
    story.globalState = story.globalState ?? {};
    normalizeStoryEdgeTargetPorts(story);
  }
  ensureDefaultBackdrop(project);
  return project;
}

export function addLocaleToProject(project: Project, locale: string): void {
  const tag = assertValidLocaleTag(locale);
  const locales = normalizeLocales(project.locales);
  if (locales.includes(tag)) {
    throw new Error(`Locale "${tag}" already exists`);
  }
  project.locales = [...locales, tag];
}

export function removeLocaleFromProject(project: Project, locale: string): void {
  const tag = assertValidLocaleTag(locale);
  const locales = normalizeLocales(project.locales);
  if (locales.length <= 1) {
    throw new Error("Cannot remove the last locale");
  }
  if (!locales.includes(tag)) {
    throw new Error(`Locale "${tag}" is not in the project`);
  }
  project.locales = locales.filter((entry) => entry !== tag);
}
