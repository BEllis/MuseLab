import type {
  Project,
  Story,
  StoryGroup,
  AssetGroup,
  AssetType,
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
import { ensureDefaultFont, isDefaultFont } from "../assets/defaultFont";
import {
  createExpression,
  createBlankExpression,
  DEFAULT_EXPRESSION_NAME,
  ensureActorExpressions,
  ensureAllActorExpressions,
  findExpression,
  getDefaultExpressionId,
  getExpressionUsage,
  isExpressionNameUnique,
  migrateActorSceneReferences,
  normalizeExpressionName,
} from "../assets/actorExpressions";
import {
  assertValidLocaleTag,
  createLocale,
  DEFAULT_LOCALES,
  getDefaultLocaleTag,
  getLocaleTags,
  hasLocaleTag,
  migrateProjectDefaultLocale,
  normalizeLocales,
} from "../locale/localeTag";
import { MUSELAB_FORMAT_VERSION, STORY_SCHEMA_ID } from "./formatVersion";
import {
  deriveUniqueNodeLabel,
  getDefaultLabelForType,
  getNodeDisplayName,
  incrementCloneLabel,
  migrateJumpNodeTargets,
} from "./nodeNames";
import { isJumpNode, isSceneNode, getStartNodes, migrateStoryNodes, normalizeStoryNode } from "./nodeTypes";
import {
  normalizeEndNodeLayouts,
  pruneEndNodeLayouts,
  clearEndNodeLayout,
  setEndNodeLayout,
} from "./endNodeLayout";
import {
  collectDescendantGroupIds,
  getStoryGroups,
  nextStoryTreeSortOrder,
  normalizeStoryGroups,
  wouldCreateStoryGroupCycle,
} from "./storyTree";
import {
  collectDescendantAssetGroupIds,
  getAssetGroups,
  getAssetGroupsForType,
  nextAssetTreeSortOrder,
  nextExpressionSortOrder,
  normalizeAssetGroups,
  wouldCreateAssetGroupCycle,
} from "./assetTree";
import { generateId } from "./id";
import {
  applyAttributesField,
  copyOptionalAttributes,
  normalizeOptionalAttributes,
} from "./attributes";

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

const DEFAULT_STORY_TEMPLATE_WRAPPERS = {
  promptStartTemplate: "@{ prompter.RevealWordsBegin(-1); }",
  promptEndTemplate: "@{ prompter.RevealEnd(); }",
  speakerStartTemplate: "@Format.BoldStart()",
  speakerEndTemplate: "@Format.BoldEnd()",
} as const satisfies Pick<
  Story,
  "promptStartTemplate" | "promptEndTemplate" | "speakerStartTemplate" | "speakerEndTemplate"
>;

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
        ...DEFAULT_STORY_TEMPLATE_WRAPPERS,
      },
    ],
    locales: normalizeLocales(undefined),
    defaultLocale: DEFAULT_LOCALES[0],
    modules: [],
  };
  ensureDefaultBackdrop(project);
  ensureDefaultFont(project);
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
  patch: Partial<
    Pick<ModuleInterface, "name" | "bindingName" | "description" | "methods" | "typescriptSource">
  >
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
  if (patch.description !== undefined) {
    module.description = patch.description.trim() || undefined;
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
    ...DEFAULT_STORY_TEMPLATE_WRAPPERS,
  };
  const start = addNodeToStory(story, { x: 100, y: 100 }, "start");
  story.entryNodeId = start.id;
  return story;
}

export function getStoryGroup(project: Project, groupId: string): StoryGroup {
  const group = getStoryGroups(project).find((entry) => entry.id === groupId);
  if (!group) {
    throw new Error(`Story group "${groupId}" not found`);
  }
  return group;
}

export function addStoryGroup(
  project: Project,
  name?: string,
  parentGroupId?: string
): StoryGroup {
  if (parentGroupId) {
    getStoryGroup(project, parentGroupId);
  }
  if (!project.storyGroups) {
    project.storyGroups = [];
  }
  const group: StoryGroup = {
    id: generateId(),
    name: name ?? `Group ${project.storyGroups.length + 1}`,
    parentGroupId,
    sortOrder: nextStoryTreeSortOrder(project, parentGroupId),
  };
  project.storyGroups.push(group);
  return group;
}

export function removeStoryGroup(project: Project, groupId: string): void {
  const groups = getStoryGroups(project);
  if (!groups.some((group) => group.id === groupId)) {
    throw new Error(`Story group "${groupId}" not found`);
  }

  const rootGroup = getStoryGroup(project, groupId);
  const removedGroupIds = new Set([groupId, ...collectDescendantGroupIds(groups, groupId)]);
  const promoteToGroupId = rootGroup.parentGroupId;

  for (const story of project.stories) {
    if (story.groupId && removedGroupIds.has(story.groupId)) {
      story.groupId = promoteToGroupId;
    }
  }

  project.storyGroups = groups.filter((group) => !removedGroupIds.has(group.id));
}

export function updateStoryGroup(
  project: Project,
  groupId: string,
  patch: Partial<Pick<StoryGroup, "name" | "parentGroupId" | "sortOrder">>
): void {
  const group = getStoryGroup(project, groupId);
  if (patch.name !== undefined) {
    group.name = patch.name;
  }
  if (patch.sortOrder !== undefined) {
    group.sortOrder = patch.sortOrder;
  }
  if (patch.parentGroupId !== undefined) {
    const nextParentGroupId = patch.parentGroupId || undefined;
    if (nextParentGroupId === groupId) {
      throw new Error("A story group cannot be its own parent");
    }
    if (nextParentGroupId) {
      getStoryGroup(project, nextParentGroupId);
      if (wouldCreateStoryGroupCycle(getStoryGroups(project), groupId, nextParentGroupId)) {
        throw new Error("Story group hierarchy cannot contain cycles");
      }
    }
    group.parentGroupId = nextParentGroupId;
  }
}

export function addStory(project: Project, name?: string, groupId?: string): Story {
  if (groupId) {
    getStoryGroup(project, groupId);
  }
  const story = createStarterStory(name ?? `Story ${project.stories.length + 1}`);
  if (groupId) {
    story.groupId = groupId;
  }
  story.sortOrder = nextStoryTreeSortOrder(project, groupId);
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
  patch: Partial<Pick<Story, "name" | "entryNodeId" | "globalState" | "groupId" | "sortOrder">> & {
    attributes?: import("./types").Attributes | null;
  }
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
  if (patch.sortOrder !== undefined) {
    story.sortOrder = patch.sortOrder;
  }
  if ("groupId" in patch) {
    if (patch.groupId) {
      getStoryGroup(project, patch.groupId);
    }
    if (patch.groupId) {
      story.groupId = patch.groupId;
    } else {
      delete story.groupId;
    }
  }
  if ("attributes" in patch) {
    applyAttributesField(story, patch.attributes);
  }
}

export function getAssetGroup(project: Project, groupId: string): AssetGroup {
  const group = getAssetGroups(project).find((entry) => entry.id === groupId);
  if (!group) {
    throw new Error(`Asset group "${groupId}" not found`);
  }
  return group;
}

export function addAssetGroup(
  project: Project,
  assetType: AssetType,
  name?: string,
  parentGroupId?: string
): AssetGroup {
  if (parentGroupId) {
    const parent = getAssetGroup(project, parentGroupId);
    if (parent.assetType !== assetType) {
      throw new Error(`Asset group "${parentGroupId}" is not a ${assetType} group`);
    }
  }
  if (!project.assetGroups) {
    project.assetGroups = [];
  }
  const typeGroups = getAssetGroupsForType(project, assetType);
  const group: AssetGroup = {
    id: generateId(),
    name: name ?? `Group ${typeGroups.length + 1}`,
    assetType,
    parentGroupId,
    sortOrder: nextAssetTreeSortOrder(project, assetType, parentGroupId),
  };
  project.assetGroups.push(group);
  return group;
}

export function removeAssetGroup(project: Project, groupId: string): void {
  const group = getAssetGroup(project, groupId);
  const groups = getAssetGroupsForType(project, group.assetType);
  if (!groups.some((entry) => entry.id === groupId)) {
    throw new Error(`Asset group "${groupId}" not found`);
  }

  const removedGroupIds = new Set([groupId, ...collectDescendantAssetGroupIds(groups, groupId)]);
  const promoteToGroupId = group.parentGroupId;

  for (const asset of project.assets) {
    if (asset.groupId && removedGroupIds.has(asset.groupId)) {
      asset.groupId = promoteToGroupId;
    }
  }

  project.assetGroups = getAssetGroups(project).filter((entry) => !removedGroupIds.has(entry.id));
}

export function updateAssetGroup(
  project: Project,
  groupId: string,
  patch: Partial<Pick<AssetGroup, "name" | "parentGroupId" | "sortOrder">>
): void {
  const group = getAssetGroup(project, groupId);
  if (patch.name !== undefined) {
    group.name = patch.name;
  }
  if (patch.sortOrder !== undefined) {
    group.sortOrder = patch.sortOrder;
  }
  if (patch.parentGroupId !== undefined) {
    const nextParentGroupId = patch.parentGroupId || undefined;
    if (nextParentGroupId === groupId) {
      throw new Error("An asset group cannot be its own parent");
    }
    if (nextParentGroupId) {
      const parent = getAssetGroup(project, nextParentGroupId);
      if (parent.assetType !== group.assetType) {
        throw new Error(`Asset group "${nextParentGroupId}" is not a ${group.assetType} group`);
      }
      const groups = getAssetGroupsForType(project, group.assetType);
      if (wouldCreateAssetGroupCycle(groups, groupId, nextParentGroupId)) {
        throw new Error("Asset group hierarchy cannot contain cycles");
      }
    }
    group.parentGroupId = nextParentGroupId;
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
    ensureDefaultFont(project);
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
    ensureDefaultFont(project);
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
  patch: Partial<Omit<StoryNode, "id" | "attributes">> & {
    attributes?: import("./types").Attributes | null;
  }
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
  if ("attributes" in patch) {
    applyAttributesField(node, patch.attributes);
    const { attributes: _attributes, ...rest } = patch;
    Object.assign(node, rest);
  } else {
    Object.assign(node, patch);
  }
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
  patch: Partial<Pick<StoryEdge, "condition" | "vertices" | "manualRoute">> & {
    attributes?: import("./types").Attributes | null;
  }
): void {
  const edge = getStory(project, storyId).edges.find((e) => e.id === edgeId);
  if (!edge) return;
  const { attributes, ...rest } = patch;
  Object.assign(edge, rest);
  if ("vertices" in patch && patch.vertices === undefined) {
    delete edge.vertices;
  }
  if ("manualRoute" in patch && patch.manualRoute === undefined) {
    delete edge.manualRoute;
  }
  if ("attributes" in patch) {
    applyAttributesField(edge, attributes);
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
    sortOrder: nextAssetTreeSortOrder(project, type, undefined),
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
    sortOrder: nextAssetTreeSortOrder(project, "actor", undefined),
    expressions: [
      createExpression(DEFAULT_EXPRESSION_NAME, {
        path: options.path,
        blobStored: options.blobStored,
      }),
    ],
  };
  asset.expressions![0].sortOrder = 0;
  asset.defaultExpressionId = asset.expressions![0].id;
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
  if (!normalized) {
    if ((asset.expressions ?? []).some((entry) => entry.name === "")) {
      throw new Error("Name the new expression before adding another");
    }
    const expression = createBlankExpression();
    expression.sortOrder = nextExpressionSortOrder(project, actorId);
    asset.expressions = [...(asset.expressions ?? []), expression];
    return expression;
  }

  if (!isExpressionNameUnique(asset, normalized)) {
    throw new Error(`Expression name "${name}" is not unique for this actor`);
  }
  const expression = createExpression(normalized);
  expression.sortOrder = nextExpressionSortOrder(project, actorId);
  asset.expressions = [...(asset.expressions ?? []), expression];
  return expression;
}

export function updateActorExpression(
  project: Project,
  actorId: string,
  expressionId: string,
  patch: Partial<Pick<ActorExpression, "name" | "sortOrder">> & {
    attributes?: import("./types").Attributes | null;
  }
): void {
  const asset = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!asset) return;
  const expression = findExpression(asset, expressionId);
  if (!expression) return;

  if (patch.name !== undefined) {
    const normalized = normalizeExpressionName(patch.name);
    if (!normalized) {
      if (expression.name !== "") {
        throw new Error("Expression name cannot be empty");
      }
      expression.name = "";
    } else if (!isExpressionNameUnique(asset, normalized, expressionId)) {
      throw new Error(`Expression name "${patch.name}" is not unique for this actor`);
    } else {
      expression.name = normalized;
    }
  }
  if (patch.sortOrder !== undefined) {
    expression.sortOrder = patch.sortOrder;
  }
  if ("attributes" in patch) {
    applyAttributesField(expression, patch.attributes);
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

  const wasDefault = getDefaultExpressionId(asset) === expressionId;
  asset.expressions = asset.expressions.filter((expression) => expression.id !== expressionId);
  if (wasDefault) {
    asset.defaultExpressionId = asset.expressions[0]?.id;
  }
}

/** Update an asset (e.g. rename or actor notes) */
export function updateAsset(
  project: Project,
  assetId: string,
  patch: Partial<
    Pick<
      Asset,
      | "name"
      | "personality"
      | "appearance"
      | "voiceAccent"
      | "backstory"
      | "notes"
      | "expressions"
      | "groupId"
      | "sortOrder"
    >
  > & {
    defaultExpressionId?: string | null;
    attributes?: import("./types").Attributes | null;
  }
): void {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return;
  if (isDefaultBackdrop(assetId)) {
    asset.name = "default";
    return;
  }
  if (patch.sortOrder !== undefined) {
    asset.sortOrder = patch.sortOrder;
  }
  if ("groupId" in patch) {
    if (patch.groupId) {
      const group = getAssetGroup(project, patch.groupId);
      if (group.assetType !== asset.type) {
        throw new Error(`Asset group "${patch.groupId}" is not a ${asset.type} group`);
      }
      asset.groupId = patch.groupId;
    } else {
      delete asset.groupId;
    }
  }
  if ("defaultExpressionId" in patch) {
    if (asset.type !== "actor") {
      throw new Error("Only actors have a default expression");
    }
    if (patch.defaultExpressionId === null) {
      delete asset.defaultExpressionId;
    } else if (patch.defaultExpressionId !== undefined) {
      if (!findExpression(asset, patch.defaultExpressionId)) {
        throw new Error(`Expression "${patch.defaultExpressionId}" not found`);
      }
      asset.defaultExpressionId = patch.defaultExpressionId;
    }
  }
  const {
    groupId: _groupId,
    sortOrder: _sortOrder,
    defaultExpressionId: _defaultExpressionId,
    attributes,
    ...rest
  } = patch;
  Object.assign(asset, rest);
  if ("attributes" in patch) {
    applyAttributesField(asset, attributes);
  }
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
  if (isDefaultBackdrop(assetId) || isDefaultFont(assetId)) return;
  project.assets = project.assets.filter((a) => a.id !== assetId);
  ensureDefaultBackdrop(project);
  ensureDefaultFont(project);
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
      | "defaultLocale"
      | "promptRendererTypescriptSource"
    >
  > & {
    attributes?: import("./types").Attributes | null;
  }
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
  if (patch.defaultLocale !== undefined) {
    const tag = assertValidLocaleTag(patch.defaultLocale);
    if (!hasLocaleTag(normalizeLocales(project.locales), tag)) {
      throw new Error(`Locale "${tag}" is not in the project`);
    }
    project.defaultLocale = tag;
  }
  if (patch.promptRendererTypescriptSource !== undefined) {
    project.promptRendererTypescriptSource = patch.promptRendererTypescriptSource;
  }
  if ("attributes" in patch) {
    applyAttributesField(project, patch.attributes);
  }
}

export function normalizeProjectAttributes(project: Project): void {
  project.attributes = normalizeOptionalAttributes(project.attributes, "attributes");

  for (const asset of project.assets) {
    asset.attributes = normalizeOptionalAttributes(
      asset.attributes,
      `assets.${asset.id}.attributes`
    );
    if (asset.expressions) {
      for (const expression of asset.expressions) {
        expression.attributes = normalizeOptionalAttributes(
          expression.attributes,
          `assets.${asset.id}.expressions.${expression.id}.attributes`
        );
      }
    }
  }

  for (const story of project.stories) {
    story.attributes = normalizeOptionalAttributes(story.attributes, `stories.${story.id}.attributes`);

    for (const node of story.nodes) {
      node.attributes = normalizeOptionalAttributes(
        node.attributes,
        `stories.${story.id}.nodes.${node.id}.attributes`
      );
      if (node.actorConfigs) {
        for (let i = 0; i < node.actorConfigs.length; i++) {
          const config = node.actorConfigs[i];
          config.attributes = normalizeOptionalAttributes(
            config.attributes,
            `stories.${story.id}.nodes.${node.id}.actorConfigs[${i}].attributes`
          );
        }
      }
      if (node.soundConfigs) {
        for (let i = 0; i < node.soundConfigs.length; i++) {
          const config = node.soundConfigs[i];
          config.attributes = normalizeOptionalAttributes(
            config.attributes,
            `stories.${story.id}.nodes.${node.id}.soundConfigs[${i}].attributes`
          );
        }
      }
    }

    for (const edge of story.edges) {
      edge.attributes = normalizeOptionalAttributes(
        edge.attributes,
        `stories.${story.id}.edges.${edge.id}.attributes`
      );
    }
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
  const manifest: Story = {
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
      ...copyOptionalAttributes(edge),
    })),
    globalState: story.globalState,
    entryNodeId: story.entryNodeId,
    endNodeLayouts: story.endNodeLayouts,
  };
  if (story.groupId) {
    manifest.groupId = story.groupId;
  }
  if (story.sortOrder !== undefined) {
    manifest.sortOrder = story.sortOrder;
  }
  return {
    ...manifest,
    ...copyOptionalAttributes(story),
  };
}

function toManifestStoryGroups(groups: StoryGroup[] | undefined): StoryGroup[] | undefined {
  if (!groups || groups.length === 0) return undefined;
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    ...(group.parentGroupId ? { parentGroupId: group.parentGroupId } : {}),
    ...(group.sortOrder !== undefined ? { sortOrder: group.sortOrder } : {}),
  }));
}

function toManifestAssetGroups(groups: AssetGroup[] | undefined): AssetGroup[] | undefined {
  if (!groups || groups.length === 0) return undefined;
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    assetType: group.assetType,
    ...(group.parentGroupId ? { parentGroupId: group.parentGroupId } : {}),
    ...(group.sortOrder !== undefined ? { sortOrder: group.sortOrder } : {}),
  }));
}

function toManifestProject(project: Project): Project {
  const locales = normalizeLocales(project.locales);
  const manifest: Project = {
    name: project.name,
    assets: project.assets,
    stories: project.stories.map(toManifestStory),
    locales,
    defaultLocale: getDefaultLocaleTag(getLocaleTags(locales), project.defaultLocale),
    modules: project.modules ?? [],
    thumbnailAspectRatio: project.thumbnailAspectRatio,
    playerResolution: project.playerResolution,
    promptRendererTypescriptSource: project.promptRendererTypescriptSource,
    ...copyOptionalAttributes(project),
  };
  const storyGroups = toManifestStoryGroups(project.storyGroups);
  if (storyGroups) {
    manifest.storyGroups = storyGroups;
  }
  const assetGroups = toManifestAssetGroups(project.assetGroups);
  if (assetGroups) {
    manifest.assetGroups = assetGroups;
  }
  return manifest;
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
    locales: normalizeLocales(data.locales),
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
  migrateProjectDefaultLocale(project);
  for (const story of project.stories) {
    story.globalState = story.globalState ?? {};
    normalizeStoryEdgeTargetPorts(story);
    normalizeEndNodeLayouts(story);
  }
  normalizeProjectModules(project);
  ensureDefaultBackdrop(project);
  ensureDefaultFont(project);
  normalizeStoryGroups(project);
  normalizeAssetGroups(project);
  normalizeProjectAttributes(project);
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

export function addLocaleToProject(
  project: Project,
  locale: string,
  options?: { displayName?: string; id?: string }
): void {
  const tag = assertValidLocaleTag(locale);
  const locales = normalizeLocales(project.locales);
  if (hasLocaleTag(locales, tag)) {
    throw new Error(`Locale "${tag}" already exists`);
  }
  project.locales = normalizeLocales([
    ...locales,
    createLocale(tag, options?.displayName, options?.id),
  ]);
}

export function updateLocaleInProject(
  project: Project,
  localeId: string,
  patch: { locale?: string; displayName?: string }
): { previousTag: string; nextTag: string } {
  const locales = normalizeLocales(project.locales);
  const index = locales.findIndex((entry) => entry.id === localeId);
  if (index < 0) {
    throw new Error(`Locale "${localeId}" not found`);
  }

  const current = locales[index]!;
  const nextTag =
    patch.locale !== undefined ? assertValidLocaleTag(patch.locale) : current.locale;
  const nextDisplayName =
    patch.displayName !== undefined
      ? patch.displayName.trim() || nextTag
      : current.displayName;

  if (nextTag !== current.locale && hasLocaleTag(locales, nextTag)) {
    throw new Error(`Locale "${nextTag}" already exists`);
  }

  locales[index] = {
    ...current,
    locale: nextTag,
    displayName: nextDisplayName,
  };
  project.locales = normalizeLocales(locales);

  if (project.defaultLocale === current.locale && nextTag !== current.locale) {
    project.defaultLocale = nextTag;
  }

  return { previousTag: current.locale, nextTag };
}

export function removeLocaleFromProject(project: Project, locale: string): void {
  const tag = assertValidLocaleTag(locale);
  const locales = normalizeLocales(project.locales);
  if (locales.length <= 1) {
    throw new Error("Cannot remove the last locale");
  }
  if (!hasLocaleTag(locales, tag)) {
    throw new Error(`Locale "${tag}" is not in the project`);
  }
  project.locales = locales.filter((entry) => entry.locale !== tag);
  if (project.defaultLocale === tag) {
    project.defaultLocale = project.locales[0]?.locale;
  }
}
