import type {
  Project,
  Story,
  StoryNode,
  StoryEdge,
  Asset,
  StoryNodeType,
  ActorExpression,
  ModuleInterface,
  CitoType,
  EndNodeLayout,
} from "./types";
import { getPlayEntryNodeId } from "./graphHierarchy";
import {
  DEFAULT_BACKDROP_ID,
  ensureDefaultBackdrop,
  isDefaultBackdrop,
  resolveBackdropId,
} from "../assets/defaultBackdrop";
import {
  createExpression,
  DEFAULT_EXPRESSION_NAME,
  ensureActorExpressions,
  ensureAllActorExpressions,
  findExpression,
  getExpressionUsage,
  isExpressionNameUnique,
  migrateActorSceneReferences,
  normalizeExpressionName,
} from "../assets/actorExpressions";
import { assertValidLocaleTag, normalizeLocales } from "../locale/localeTag";
import { MUSELAB_FORMAT_VERSION, STORY_SCHEMA_ID } from "./formatVersion";
import {
  deriveUniqueNodeLabel,
  getDefaultLabelForType,
  getNodeDisplayName,
  incrementCloneLabel,
  migrateJumpNodeTargets,
} from "./nodeNames";
import { isJumpNode, isSceneNode, getStartNodes, migrateStoryNodes, normalizeStoryNode } from "./nodeTypes";
import { pruneEndNodeLayouts, clearEndNodeLayout, setEndNodeLayout } from "./endNodeLayout";
import { generateId } from "./id";

export { generateId } from "./id";

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
    modules: [],
  };
  ensureDefaultBackdrop(project);
  return project;
}

const RESERVED_BINDING_NAMES = new Set(["rt", "format", "prompter"]);

export function validateBindingName(
  project: Project,
  bindingName: string,
  excludeModuleId?: string
): void {
  const trimmed = bindingName.trim();
  if (!/^[a-z][a-zA-Z0-9]*$/.test(trimmed)) {
    throw new Error(
      `Binding name "${bindingName}" must be camelCase starting with a lowercase letter`
    );
  }
  if (RESERVED_BINDING_NAMES.has(trimmed)) {
    throw new Error(`Binding name "${trimmed}" is reserved`);
  }
  const duplicate = project.modules.find(
    (service) => service.bindingName === trimmed && service.id !== excludeModuleId
  );
  if (duplicate) {
    throw new Error(`Binding name "${trimmed}" is already used by ${duplicate.name}`);
  }
}

function citoTypeDefaultValue(type: CitoType): string {
  switch (type) {
    case "void":
      return "";
    case "string":
      return '""';
    case "bool":
      return "false";
    case "int":
      return "0";
    case "double":
      return "0.0";
    default:
      return "null";
  }
}

export function createDefaultModule(name?: string, index?: number): ModuleInterface {
  const suffix = index ?? 1;
  const binding = `module${suffix}`;
  return {
    id: generateId(),
    name: name ?? `IModule${suffix}`,
    bindingName: binding,
    methods: [
      {
        name: "DoSomething",
        parameters: [],
        returnType: "void",
      },
    ],
  };
}

export function addModule(project: Project, name?: string): ModuleInterface {
  const bindingIndex = project.modules.length + 1;
  let service = createDefaultModule(name, bindingIndex);
  let attempt = bindingIndex;
  while (project.modules.some((entry) => entry.bindingName === service.bindingName)) {
    attempt += 1;
    service = createDefaultModule(name, attempt);
  }
  validateBindingName(project, service.bindingName);
  project.modules.push(service);
  return service;
}

export function removeModule(project: Project, moduleId: string): void {
  project.modules = project.modules.filter((module) => module.id !== moduleId);
}

export function updateModule(
  project: Project,
  moduleId: string,
  patch: Partial<Pick<ModuleInterface, "name" | "bindingName" | "methods" | "typescriptSource">>
): void {
  const module = project.modules.find((entry) => entry.id === moduleId);
  if (!module) {
    throw new Error(`Module "${moduleId}" not found`);
  }
  if (patch.name !== undefined) {
    module.name = patch.name.trim() || module.name;
  }
  if (patch.bindingName !== undefined) {
    validateBindingName(project, patch.bindingName, moduleId);
    module.bindingName = patch.bindingName.trim();
  }
  if (patch.methods !== undefined) {
    module.methods = patch.methods;
  }
  if (patch.typescriptSource !== undefined) {
    module.typescriptSource = patch.typescriptSource;
  }
}

export function normalizeProjectModules(project: Project & { services?: ModuleInterface[] }): void {
  if (!Array.isArray(project.modules) && Array.isArray(project.services)) {
    project.modules = project.services;
  }
  project.modules = Array.isArray(project.modules) ? project.modules : [];
  delete project.services;
}

export { citoTypeDefaultValue };

/** Blank slate for File → New: default backdrop asset and one Start node. */
export function createStarterProject(name: string = "Untitled"): Project {
  const project = createEmptyProject(name);
  const storyId = getFirstStoryId(project);
  const start = addNode(project, storyId, { x: 100, y: 100 }, "start");
  updateStory(project, storyId, { entryNodeId: start.id });
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
  const start = addNodeToStory(story, { x: 100, y: 100 }, "start");
  story.entryNodeId = start.id;
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

function defaultJumpTarget(
  story: Story,
  storyId: string
): Pick<StoryNode, "jumpTargetStoryId" | "jumpTargetStartNodeId"> {
  const starts = getStartNodes(story);
  const entryStart =
    story.entryNodeId != null
      ? starts.find((node) => node.id === story.entryNodeId)
      : undefined;
  const targetStart = entryStart ?? starts[0];
  return {
    jumpTargetStoryId: storyId,
    jumpTargetStartNodeId: targetStart?.id,
  };
}

function createNodeForType(
  story: Story,
  storyId: string,
  type: StoryNodeType,
  position: { x: number; y: number }
): StoryNode {
  const id = generateId();
  const label = deriveUniqueNodeLabel(story, getDefaultLabelForType(type));

  if (type === "start") {
    return { id, type: "start", position, label };
  }
  if (type === "jump") {
    return { id, type: "jump", position, ...defaultJumpTarget(story, storyId) };
  }
  return {
    id,
    type: "scene",
    position,
    label,
    backdropId: DEFAULT_BACKDROP_ID,
    actorConfigs: [],
    soundConfigs: [],
  };
}

function addNodeToStory(
  story: Story,
  position?: { x: number; y: number },
  type: StoryNodeType = "scene"
): StoryNode {
  const node = createNodeForType(story, story.id, type, position ?? { x: 0, y: 0 });
  story.nodes.push(node);
  return node;
}

export type AddNodeOptions = {
  type?: StoryNodeType;
};

/** Add a node to a story; returns the new node */
export function addNode(
  project: Project,
  storyId: string,
  position?: { x: number; y: number },
  type: StoryNodeType = "scene"
): StoryNode {
  if (type === "scene") {
    ensureDefaultBackdrop(project);
  }
  return addNodeToStory(getStory(project, storyId), position, type);
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

  const id = generateId();
  const clonedLabel = deriveUniqueNodeLabel(
    story,
    incrementCloneLabel(getNodeDisplayName(source))
  );

  let node: StoryNode;
  if (isSceneNode(source)) {
    ensureDefaultBackdrop(project);
    node = {
      id,
      type: "scene",
      position,
      label: clonedLabel,
      backdropId: resolveBackdropId(project, source.backdropId ?? DEFAULT_BACKDROP_ID),
      actorConfigs: (source.actorConfigs ?? []).map((config) => ({ ...config })),
      soundConfigs: (source.soundConfigs ?? []).map((config) => ({ ...config })),
    };
  } else if (isJumpNode(source)) {
    node = {
      id,
      type: "jump",
      position,
      jumpTargetStoryId: source.jumpTargetStoryId,
      jumpTargetStartNodeId: source.jumpTargetStartNodeId,
    };
  } else {
    node = {
      id,
      type: "start",
      position,
      label: clonedLabel,
    };
  }

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
  if (story.entryNodeId === nodeId) {
    story.entryNodeId = undefined;
  }
  clearEndNodeLayout(story, nodeId);
  pruneEndNodeLayouts(story);
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

/** Persist designer layout for a terminal scene's synthetic End node. */
export function updateEndNodeLayout(
  project: Project,
  storyId: string,
  sceneId: string,
  layout: EndNodeLayout
): void {
  setEndNodeLayout(getStory(project, storyId), sceneId, layout);
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
  if (node.type === "jump") {
    if ("label" in patch) {
      const { label: _label, ...rest } = patch;
      patch = rest;
    }
    delete node.label;
  }
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
  pruneEndNodeLayouts(story);
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
  pruneEndNodeLayouts(story);
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
  if (type === "actor") {
    ensureActorExpressions(asset);
  }
  return asset;
}

/** Create a blank actor with a default placeholder expression. */
export function addBlankActor(project: Project, name: string): Asset {
  return addAsset(project, "actor", name, {});
}

/** Create an actor whose default expression uses imported media. */
export function addActorFromImage(
  project: Project,
  name: string,
  options: { path?: string; blobStored?: boolean }
): Asset {
  const asset: Asset = {
    id: generateId(),
    type: "actor",
    name,
    expressions: [
      createExpression(DEFAULT_EXPRESSION_NAME, {
        path: options.path,
        blobStored: options.blobStored,
      }),
    ],
  };
  project.assets.push(asset);
  return asset;
}

export function addActorExpression(project: Project, actorId: string, name: string): ActorExpression {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset) {
    throw new Error(`Actor "${actorId}" not found`);
  }
  ensureActorExpressions(asset);
  const normalized = normalizeExpressionName(name);
  if (!normalized || !isExpressionNameUnique(asset, normalized)) {
    throw new Error(`Expression name "${name}" is not unique for this actor`);
  }
  const expression = createExpression(normalized);
  asset.expressions = [...(asset.expressions ?? []), expression];
  return expression;
}

export function updateActorExpression(
  project: Project,
  actorId: string,
  expressionId: string,
  patch: Partial<Pick<ActorExpression, "name">>
): void {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset) return;
  const expression = findExpression(asset, expressionId);
  if (!expression) return;

  if (patch.name !== undefined) {
    const normalized = normalizeExpressionName(patch.name);
    if (!normalized || !isExpressionNameUnique(asset, normalized, expressionId)) {
      throw new Error(`Expression name "${patch.name}" is not unique for this actor`);
    }
    expression.name = normalized;
  }
}

export function replaceActorExpressionMedia(
  project: Project,
  actorId: string,
  expressionId: string,
  options: { path?: string; blobStored?: boolean }
): void {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset) return;
  const expression = findExpression(asset, expressionId);
  if (!expression) return;

  delete expression.imageData;
  delete expression.imageMimeType;
  delete expression.url;

  if (options.path) {
    expression.path = options.path;
    delete expression.blobStored;
  } else {
    delete expression.path;
    if (options.blobStored) {
      expression.blobStored = true;
    } else {
      delete expression.blobStored;
    }
  }
}

export function removeActorExpression(
  project: Project,
  actorId: string,
  expressionId: string
): void {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset?.expressions) return;

  if (asset.expressions.length <= 1) {
    throw new Error("Cannot remove the last expression from an actor");
  }
  if (getExpressionUsage(project, actorId, expressionId) > 0) {
    throw new Error("Cannot remove an expression that is used in scenes");
  }

  asset.expressions = asset.expressions.filter((expression) => expression.id !== expressionId);
}

/** Update an asset (e.g. rename or actor notes) */
export function updateAsset(
  project: Project,
  assetId: string,
  patch: Partial<
    Pick<Asset, "name" | "personality" | "appearance" | "backstory" | "notes" | "expressions">
  >
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
    Pick<
      Project,
      | "name"
      | "thumbnailAspectRatio"
      | "playerResolution"
      | "locales"
      | "promptRendererTypescriptSource"
    >
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
  if (patch.promptRendererTypescriptSource !== undefined) {
    project.promptRendererTypescriptSource = patch.promptRendererTypescriptSource;
  }
}

type LegacyProjectJson = Omit<Project, "modules"> & {
  services?: ModuleInterface[];
  modules?: ModuleInterface[];
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
    nodes: story.nodes.map((node) => normalizeStoryNode(node)),
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
    endNodeLayouts: story.endNodeLayouts,
  };
}

function toManifestProject(project: Project): Project {
  return {
    name: project.name,
    assets: project.assets,
    stories: project.stories.map(toManifestStory),
    locales: normalizeLocales(project.locales),
    modules: project.modules ?? [],
    thumbnailAspectRatio: project.thumbnailAspectRatio,
    playerResolution: project.playerResolution,
    promptRendererTypescriptSource: project.promptRendererTypescriptSource,
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
    const project = data as Project;
    normalizeProjectModules(project);
    return project;
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
    modules: data.modules ?? data.services ?? [],
    thumbnailAspectRatio: data.thumbnailAspectRatio,
    playerResolution: data.playerResolution,
    promptRendererTypescriptSource: data.promptRendererTypescriptSource,
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
  normalizeProjectModules(project);
  ensureDefaultBackdrop(project);
  return project;
}

/** Apply node-type migration and strip legacy-only fields after prompts are extracted. */
export function finalizeProjectNodes(project: Project): void {
  ensureAllActorExpressions(project);
  migrateActorSceneReferences(project);
  migrateJumpNodeTargets(project);
  for (const story of project.stories) {
    migrateStoryNodes(story);
    for (let i = 0; i < story.nodes.length; i++) {
      story.nodes[i] = normalizeStoryNode(story.nodes[i]);
    }
  }
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
