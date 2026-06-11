import type { ProjectBundle } from "../model/projectBundle";
import type {
  ActorSceneConfig,
  Project,
  SoundConfig,
  Story,
  StoryNode,
  StoryPrompts,
} from "../model/types";
import {
  addEdge,
  addNode,
  getStory,
  removeEdge,
  removeNode,
  updateNode,
} from "../model/project";
import { resolveStoryIdByPath } from "../export/resolveStoryPath";
import { getNodeDisplayName } from "../model/nodeNames";
import { isJumpNode, isSceneNode, getStartNodes } from "../model/nodeTypes";
import { validatePlayEntry } from "../model/graphHierarchy";
import { isUuid } from "../model/id";
import {
  ensureLocalePrompts,
  ensureStoryPrompts,
  setEdgeOptionText,
  setNodeSpeaker,
  setNodeTextTemplate,
} from "../locale/prompts";
import { normalizeLocaleTags } from "../locale/localeTag";
import { applyAttributesField } from "../model/attributes";
import { DEFAULT_BACKDROP_ID, resolveBackdropId } from "../assets/defaultBackdrop";
import { importAttributes } from "./attributes";
import {
  formatAssetPath,
  normalizeSoundAssetName,
  resolveAssetById,
  resolveAssetIdByPath,
} from "./assetPath";
import { resolveExpressionIdByName } from "./expressionPath";
import { assignScenePositions, assignStartNodePosition } from "./layout";
import type {
  ImportScriptMode,
  MuseLabProjectScript,
  MuseLabScriptDocument,
  MuseLabScriptOption,
  MuseLabScriptScene,
  MuseLabStoryScript,
} from "./types";
import { isProjectScript } from "./types";

export interface ImportScriptResult {
  bundle: ProjectBundle;
  warnings: string[];
}

function splitAssetPathForSound(assetPath: string): { groupPath: string; assetName: string } {
  const trimmed = assetPath.trim();
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash < 0) {
    return { groupPath: "", assetName: normalizeSoundAssetName(trimmed) };
  }
  return {
    groupPath: trimmed.slice(0, lastSlash),
    assetName: normalizeSoundAssetName(trimmed.slice(lastSlash + 1)),
  };
}

function resolveSoundAssetIdFromScript(project: Project, soundPath: string): string {
  const { groupPath, assetName } = splitAssetPathForSound(soundPath);
  const fullPath = formatAssetPath(groupPath, assetName);
  return resolveAssetIdByPath(project, "sound", fullPath);
}

function captureStoryPrompts(
  bundle: ProjectBundle,
  storyId: string
): Record<string, StoryPrompts> {
  const captured: Record<string, StoryPrompts> = {};
  for (const locale of normalizeLocaleTags(bundle.project.locales)) {
    const localePrompts = bundle.promptsByLocale[locale];
    const storyPrompts = localePrompts?.stories[storyId];
    if (storyPrompts) {
      captured[locale] = JSON.parse(JSON.stringify(storyPrompts)) as StoryPrompts;
    }
  }
  return captured;
}

function clearStoryPrompts(bundle: ProjectBundle, storyId: string): void {
  for (const locale of normalizeLocaleTags(bundle.project.locales)) {
    const prompts = ensureLocalePrompts(bundle.promptsByLocale, locale);
    ensureStoryPrompts(prompts, storyId);
    prompts.stories[storyId] = { nodes: {}, edges: {} };
  }
}

function mergeStoryAttributes(
  story: Story,
  incoming: ReturnType<typeof importAttributes>,
  mode: ImportScriptMode
): void {
  if (!incoming) {
    if (mode === "replace") {
      delete story.attributes;
    }
    return;
  }
  if (mode === "replace") {
    applyAttributesField(story, incoming);
    return;
  }
  story.attributes = {
    ...(story.attributes ?? {}),
    ...incoming,
  };
}

function findSceneByName(story: Story, name: string): StoryNode | undefined {
  const trimmed = name.trim();
  return story.nodes.find(
    (node) => isSceneNode(node) && getNodeDisplayName(node) === trimmed
  );
}

function findSceneByIdOrName(
  story: Story,
  nodeId: string | undefined,
  nodeName: string
): StoryNode | undefined {
  if (nodeId && isUuid(nodeId)) {
    const byId = story.nodes.find((node) => node.id === nodeId && isSceneNode(node));
    if (byId) return byId;
  }
  return findSceneByName(story, nodeName);
}

function ensureStartNode(story: Story, project: Project, storyId: string): StoryNode {
  const starts = getStartNodes(story);
  if (starts.length > 0) {
    return starts[0];
  }
  return addNode(project, storyId, { x: 100, y: 100 }, "start");
}

function applyStoryMetadata(
  story: Story,
  script: MuseLabStoryScript,
  mode: ImportScriptMode
): void {
  if (script.prompt_start_template !== undefined) {
    story.promptStartTemplate = script.prompt_start_template;
  }
  if (script.prompt_end_template !== undefined) {
    story.promptEndTemplate = script.prompt_end_template;
  }
  if (script.speaker_start_template !== undefined) {
    story.speakerStartTemplate = script.speaker_start_template;
  }
  if (script.speaker_end_template !== undefined) {
    story.speakerEndTemplate = script.speaker_end_template;
  }
  mergeStoryAttributes(
    story,
    importAttributes(script.attributes, "attributes"),
    mode
  );
}

function buildActorConfigs(
  project: Project,
  scene: MuseLabScriptScene
): ActorSceneConfig[] {
  const configs: ActorSceneConfig[] = [];
  for (const [index, actorEntry] of (scene.actors ?? []).entries()) {
    const assetId =
      actorEntry.actor_id && project.assets.some((asset) => asset.id === actorEntry.actor_id)
        ? actorEntry.actor_id
        : resolveAssetIdByPath(project, "actor", actorEntry.actor_path);
    const actor = resolveAssetById(project, assetId);
    const expressionId = resolveExpressionIdByName(actor, actorEntry.expression);
    const config: ActorSceneConfig = { assetId, expressionId };
    const attrs = importAttributes(actorEntry.attributes, `scenes[].actors[${index}].attributes`);
    if (attrs) config.attributes = attrs;
    configs.push(config);
  }
  return configs;
}

function buildSoundConfig(project: Project, scene: MuseLabScriptScene): SoundConfig[] {
  if (!scene.sound) return [];
  const sound = scene.sound;
  const assetId =
    sound.sound_id && project.assets.some((asset) => asset.id === sound.sound_id)
      ? sound.sound_id
      : resolveSoundAssetIdFromScript(project, sound.sound_path);
  const config: SoundConfig = { assetId };
  if (sound.start_on_load) config.startOnLoad = true;
  if (sound.stop_on_load) config.stopOnLoad = true;
  if (sound.loop) config.loop = true;
  if (sound.start_time != null) config.startTime = sound.start_time;
  if (sound.end_time != null) config.endTime = sound.end_time;
  const attrs = importAttributes(sound.attributes, "scenes[].sound.attributes");
  if (attrs) config.attributes = attrs;
  return [config];
}

function resolveBackdropIdFromScript(
  project: Project,
  scene: MuseLabScriptScene
): string {
  if (!scene.backdrop) {
    return DEFAULT_BACKDROP_ID;
  }
  if (
    scene.backdrop.backdrop_id &&
    project.assets.some((asset) => asset.id === scene.backdrop!.backdrop_id)
  ) {
    return resolveBackdropId(project, scene.backdrop.backdrop_id);
  }
  return resolveBackdropId(
    project,
    resolveAssetIdByPath(project, "backdrop", scene.backdrop.backdrop_path)
  );
}

function upsertSceneNode(
  project: Project,
  story: Story,
  storyId: string,
  scene: MuseLabScriptScene,
  mode: ImportScriptMode
): StoryNode {
  const existing = findSceneByIdOrName(story, scene.node_id, scene.node_name);
  if (existing) {
    const attrs = importAttributes(scene.attributes, `scenes["${scene.node_name}"].attributes`);
    updateNode(project, storyId, existing.id, {
      label: scene.node_name,
      backdropId: resolveBackdropIdFromScript(project, scene),
      actorConfigs: buildActorConfigs(project, scene),
      soundConfigs: buildSoundConfig(project, scene),
      attributes: attrs ?? (mode === "replace" ? null : undefined),
    });
    return existing;
  }

  const node = addNode(project, storyId, { x: 0, y: 0 }, "scene");
  if (
    scene.node_id &&
    isUuid(scene.node_id) &&
    !story.nodes.some((entry) => entry.id === scene.node_id)
  ) {
    node.id = scene.node_id;
  }
  updateNode(project, storyId, node.id, {
    label: scene.node_name,
    backdropId: resolveBackdropIdFromScript(project, scene),
    actorConfigs: buildActorConfigs(project, scene),
    soundConfigs: buildSoundConfig(project, scene),
    attributes: importAttributes(scene.attributes, `scenes["${scene.node_name}"].attributes`) ?? null,
  });
  return getStory(project, storyId).nodes.find((entry) => entry.id === node.id)!;
}

function applySceneDialogue(
  bundle: ProjectBundle,
  storyId: string,
  nodeId: string,
  scene: MuseLabScriptScene,
  mode: ImportScriptMode,
  projectLocales: string[]
): void {
  const dialogueLocales = Object.keys(scene.dialogue ?? {});
  const localesToWrite =
    mode === "merge" ? dialogueLocales : [...new Set([...projectLocales, ...dialogueLocales])];

  for (const locale of localesToWrite) {
    const entry = scene.dialogue?.[locale];
    const prompts = ensureLocalePrompts(bundle.promptsByLocale, locale);
    const storyPrompts = ensureStoryPrompts(prompts, storyId);

    if (!entry) {
      if (mode === "replace") {
        delete storyPrompts.nodes[nodeId];
      }
      continue;
    }

    if (entry.dialogue !== undefined) {
      setNodeTextTemplate(prompts, storyId, nodeId, entry.dialogue);
    } else if (mode === "replace") {
      const current = storyPrompts.nodes[nodeId];
      if (current) delete current.textTemplate;
    }

    if (entry.speaker !== undefined) {
      setNodeSpeaker(prompts, storyId, nodeId, entry.speaker);
    } else if (mode === "replace") {
      const current = storyPrompts.nodes[nodeId];
      if (current) delete current.speaker;
    }
  }
}

function normalizeOptionCondition(option: MuseLabScriptOption): string | undefined {
  const condition = option.condition ?? option.on_click;
  return condition?.trim() || undefined;
}

function rebuildEdges(
  project: Project,
  bundle: ProjectBundle,
  story: Story,
  storyId: string,
  scenes: MuseLabScriptScene[],
  defaultLocale: string,
  mode: ImportScriptMode
): Array<{ source: string; target: string }> {
  const structuralEdges: Array<{ source: string; target: string }> = [];

  for (const scene of scenes) {
    const sourceNode = findSceneByIdOrName(story, scene.node_id, scene.node_name);
    if (!sourceNode) {
      throw new Error(`Scene not found after import: "${scene.node_name}"`);
    }

    const desiredTargets = new Map<string, MuseLabScriptOption>();
    for (const option of scene.options ?? []) {
      const target = findSceneByIdOrName(story, option.node_id, option.node_name);
      if (!target) {
        throw new Error(
          `Option target not found: "${option.node_name}" from scene "${scene.node_name}"`
        );
      }
      desiredTargets.set(target.id, option);
    }

    const existingOutEdges = story.edges.filter((edge) => edge.sourceNodeId === sourceNode.id);
    for (const edge of existingOutEdges) {
      const target = story.nodes.find((node) => node.id === edge.targetNodeId);
      if (!target || !isSceneNode(target)) continue;
      if (!desiredTargets.has(target.id)) {
        removeEdge(project, storyId, edge.id);
        for (const locale of normalizeLocaleTags(bundle.project.locales)) {
          const prompts = ensureLocalePrompts(bundle.promptsByLocale, locale);
          delete ensureStoryPrompts(prompts, storyId).edges[edge.id];
        }
      }
    }

    for (const [targetId, option] of desiredTargets) {
      let edge = story.edges.find(
        (entry) =>
          entry.sourceNodeId === sourceNode.id &&
          entry.targetNodeId === targetId &&
          (option.edge_id && isUuid(option.edge_id) ? entry.id === option.edge_id : true)
      );

      if (!edge && option.edge_id && isUuid(option.edge_id)) {
        edge = story.edges.find((entry) => entry.id === option.edge_id);
      }

      const condition = normalizeOptionCondition(option);
      const attrs = importAttributes(
        option.attributes,
        `scenes["${scene.node_name}"].options[].attributes`
      );

      if (edge) {
        edge.condition = condition;
        applyAttributesField(edge, attrs ?? (mode === "replace" ? null : edge.attributes));
      } else {
        edge = addEdge(project, storyId, sourceNode.id, targetId, {
          id: option.edge_id && isUuid(option.edge_id) ? option.edge_id : undefined,
          condition,
        });
        if (attrs) edge.attributes = attrs;
      }

      if (option.label !== undefined) {
        const localePrompts = ensureLocalePrompts(bundle.promptsByLocale, defaultLocale);
        setEdgeOptionText(localePrompts, storyId, edge.id, option.label);
      } else if (mode === "replace") {
        for (const locale of normalizeLocaleTags(bundle.project.locales)) {
          delete ensureStoryPrompts(
            ensureLocalePrompts(bundle.promptsByLocale, locale),
            storyId
          ).edges[edge.id];
        }
      }

      structuralEdges.push({ source: sourceNode.id, target: targetId });
    }
  }

  return structuralEdges;
}

function wireStartToEntry(
  project: Project,
  story: Story,
  storyId: string,
  entryScene: StoryNode
): void {
  const startNode = ensureStartNode(story, project, storyId);
  story.entryNodeId = startNode.id;

  const existing = story.edges.find(
    (edge) => edge.sourceNodeId === startNode.id && edge.targetNodeId === entryScene.id
  );
  if (!existing) {
    const otherStartEdges = story.edges.filter((edge) => edge.sourceNodeId === startNode.id);
    for (const edge of otherStartEdges) {
      removeEdge(project, storyId, edge.id);
    }
    addEdge(project, storyId, startNode.id, entryScene.id);
  }
}

function removeScenesNotInScript(
  project: Project,
  bundle: ProjectBundle,
  story: Story,
  storyId: string,
  scenes: MuseLabScriptScene[],
  mode: ImportScriptMode
): void {
  if (mode !== "merge") return;
  const keepNames = new Set(scenes.map((scene) => scene.node_name.trim()));
  const keepIds = new Set(
    scenes.map((scene) => scene.node_id).filter((id): id is string => Boolean(id && isUuid(id)))
  );

  for (const node of [...story.nodes]) {
    if (!isSceneNode(node) && !isJumpNode(node)) continue;
    const name = getNodeDisplayName(node);
    if (keepIds.has(node.id) || keepNames.has(name)) continue;
    removeNode(project, storyId, node.id);
    for (const locale of normalizeLocaleTags(bundle.project.locales)) {
      delete ensureStoryPrompts(
        ensureLocalePrompts(bundle.promptsByLocale, locale),
        storyId
      ).nodes[node.id];
    }
  }
}

function prepareReplaceMode(
  project: Project,
  bundle: ProjectBundle,
  story: Story,
  storyId: string
): void {
  for (const node of [...story.nodes]) {
    if (isSceneNode(node) || isJumpNode(node)) {
      removeNode(project, storyId, node.id);
    }
  }
  story.edges = [];
  clearStoryPrompts(bundle, storyId);
}

function resolveTargetStoryId(
  project: Project,
  script: MuseLabStoryScript,
  explicitStoryId: string | null
): string {
  if (explicitStoryId) {
    getStory(project, explicitStoryId);
    return explicitStoryId;
  }
  if (script.story_id && project.stories.some((story) => story.id === script.story_id)) {
    return script.story_id;
  }
  if (script.story_name) {
    return resolveStoryIdByPath(project, script.story_path ?? "", script.story_name);
  }
  throw new Error("Script import requires a target story (story_id, story_path+story_name, or active story)");
}

export function importStoryScript(
  bundle: ProjectBundle,
  script: MuseLabStoryScript,
  mode: ImportScriptMode,
  targetStoryId: string | null = null
): ImportScriptResult {
  const warnings: string[] = [];
  const { project } = bundle;
  const storyId = resolveTargetStoryId(project, script, targetStoryId);
  const story = getStory(project, storyId);
  const defaultLocale = normalizeLocaleTags(project.locales)[0];

  if (mode === "replace") {
    prepareReplaceMode(project, bundle, story, storyId);
  }

  applyStoryMetadata(story, script, mode);

  for (const scene of script.scenes) {
    const node = upsertSceneNode(project, story, storyId, scene, mode);
    applySceneDialogue(bundle, storyId, node.id, scene, mode, normalizeLocaleTags(project.locales));
  }

  removeScenesNotInScript(project, bundle, story, storyId, script.scenes, mode);

  const entryName =
    script.entry_node_name?.trim() ||
    script.scenes[0]?.node_name ||
    getNodeDisplayName(
      story.nodes.find((node) => isSceneNode(node))!,
      project
    );
  const entryScene = findSceneByName(story, entryName);
  if (!entryScene) {
    throw new Error(`Entry scene not found: "${entryName}"`);
  }

  const sceneEdges = rebuildEdges(
    project,
    bundle,
    story,
    storyId,
    script.scenes,
    defaultLocale,
    mode
  );
  wireStartToEntry(project, story, storyId, entryScene);

  const sceneIds = story.nodes.filter(isSceneNode).map((node) => node.id);
  const positions = assignScenePositions(sceneIds, sceneEdges, entryScene.id);
  const startNode = getStartNodes(story)[0];
  if (startNode) {
    startNode.position = assignStartNodePosition(positions[entryScene.id]);
  }
  for (const [nodeId, position] of Object.entries(positions)) {
    const node = story.nodes.find((entry) => entry.id === nodeId);
    if (node) node.position = position;
  }

  const validation = validatePlayEntry(story);
  if (!validation.ok) {
    throw new Error(`Imported story is invalid: ${validation.reason}`);
  }

  return { bundle, warnings };
}

export function importProjectScript(
  bundle: ProjectBundle,
  script: MuseLabProjectScript,
  mode: ImportScriptMode
): ImportScriptResult {
  const warnings: string[] = [];
  for (const storyScript of script.stories) {
    const result = importStoryScript(bundle, storyScript, mode, null);
    warnings.push(...result.warnings);
  }
  return { bundle, warnings };
}

export function importScriptDocument(
  bundle: ProjectBundle,
  document: MuseLabScriptDocument,
  mode: ImportScriptMode,
  targetStoryId: string | null = null
): ImportScriptResult {
  if (isProjectScript(document)) {
    return importProjectScript(bundle, document, mode);
  }
  return importStoryScript(bundle, document, mode, targetStoryId);
}

export function captureStoryScriptState(
  bundle: ProjectBundle,
  storyId: string
): { story: Story; storyPromptsByLocale: Record<string, StoryPrompts> } {
  const story = JSON.parse(JSON.stringify(getStory(bundle.project, storyId))) as Story;
  return {
    story,
    storyPromptsByLocale: captureStoryPrompts(bundle, storyId),
  };
}

export function restoreStoryScriptState(
  bundle: ProjectBundle,
  storyId: string,
  payload: { story: Story; storyPromptsByLocale: Record<string, StoryPrompts> }
): void {
  const index = bundle.project.stories.findIndex((story) => story.id === storyId);
  if (index < 0) {
    throw new Error(`Story "${storyId}" not found`);
  }
  bundle.project.stories[index] = JSON.parse(JSON.stringify(payload.story)) as Story;
  for (const [locale, storyPrompts] of Object.entries(payload.storyPromptsByLocale)) {
    const prompts = ensureLocalePrompts(bundle.promptsByLocale, locale);
    prompts.stories[storyId] = JSON.parse(JSON.stringify(storyPrompts)) as StoryPrompts;
  }
}
