import type { ProjectBundle } from "../model/projectBundle";
import type { Project, Story, StoryNode } from "../model/types";
import { getStory } from "../model/project";
import { isUuid } from "../model/id";
import { getNodeDisplayName } from "../model/nodeNames";
import { isSceneNode } from "../model/nodeTypes";
import {
  getEdgeOptionTextForLocale,
  getNodeSpeakerForLocale,
  getNodeTextTemplateForLocale,
} from "../locale/prompts";
import { getDefaultLocaleTag } from "../locale/localeTag";
import { SCRIPT_SCHEMA_ID, MUSELAB_SCRIPT_FORMAT_VERSION } from "../model/formatVersion";
import { getStoryGroupPath } from "./storyPath";
import {
  exportAttributes,
} from "./attributes";
import {
  getAssetPath,
  resolveAssetById,
  normalizeSoundAssetName,
} from "./assetPath";
import { findExpression } from "../assets/actorExpressions";
import type {
  MuseLabProjectScript,
  MuseLabScriptActor,
  MuseLabScriptOption,
  MuseLabScriptScene,
  MuseLabScriptSound,
  MuseLabStoryScript,
} from "./types";

function getEntrySceneName(story: Story, project: Project): string | undefined {
  const startId = story.entryNodeId;
  if (!startId) return undefined;
  const startEdge = story.edges.find((edge) => edge.sourceNodeId === startId);
  if (!startEdge) return undefined;
  const target = story.nodes.find((node) => node.id === startEdge.targetNodeId);
  if (!target || !isSceneNode(target)) return undefined;
  return getNodeDisplayName(target, project);
}

function exportSceneActors(
  project: Project,
  node: StoryNode
): MuseLabScriptActor[] | undefined {
  const configs = node.actorConfigs ?? [];
  if (configs.length === 0) return undefined;

  return configs.map((config) => {
    const actor = resolveAssetById(project, config.assetId);
    const expression = findExpression(actor, config.expressionId);
    const entry: MuseLabScriptActor = {
      actor_path: getAssetPath(project, actor),
      expression: expression?.name ?? "default",
    };
    if (isUuid(config.assetId)) {
      entry.actor_id = config.assetId;
    }
    const attrs = exportAttributes(config.attributes);
    if (attrs) entry.attributes = attrs;
    return entry;
  });
}

function exportSceneSound(project: Project, node: StoryNode): MuseLabScriptSound | undefined {
  const config = node.soundConfigs?.[0];
  if (!config) return undefined;
  const sound = resolveAssetById(project, config.assetId);
  const entry: MuseLabScriptSound = {
    sound_path: getAssetPath(project, {
      ...sound,
      name: normalizeSoundAssetName(sound.name),
    }),
  };
  if (isUuid(config.assetId)) {
    entry.sound_id = config.assetId;
  }
  if (config.startOnLoad) entry.start_on_load = true;
  if (config.stopOnLoad) entry.stop_on_load = true;
  if (config.loop) entry.loop = true;
  if (config.startTime != null) entry.start_time = config.startTime;
  if (config.endTime != null) entry.end_time = config.endTime;
  const attrs = exportAttributes(config.attributes);
  if (attrs) entry.attributes = attrs;
  return entry;
}

function exportSceneOptions(
  bundle: ProjectBundle,
  story: Story,
  project: Project,
  node: StoryNode,
  defaultLocale: string
): MuseLabScriptOption[] | undefined {
  const outEdges = story.edges.filter((edge) => edge.sourceNodeId === node.id);
  if (outEdges.length === 0) return undefined;

  const options: MuseLabScriptOption[] = [];
  for (const edge of outEdges) {
    const target = story.nodes.find((entry) => entry.id === edge.targetNodeId);
    if (!target || !isSceneNode(target)) continue;

    const option: MuseLabScriptOption = {
      node_name: getNodeDisplayName(target, project),
    };
    if (isUuid(edge.id)) option.edge_id = edge.id;
    if (isUuid(target.id)) option.node_id = target.id;
    const label = getEdgeOptionTextForLocale(
      bundle.promptsByLocale,
      defaultLocale,
      story.id,
      edge.id
    );
    if (label) option.label = label;
    if (edge.condition) option.condition = edge.condition;
    const attrs = exportAttributes(edge.attributes);
    if (attrs) option.attributes = attrs;
    options.push(option);
  }
  return options.length > 0 ? options : undefined;
}

function exportSceneDialogue(
  bundle: ProjectBundle,
  storyId: string,
  nodeId: string,
  project: Project
): MuseLabScriptScene["dialogue"] {
  const dialogue: NonNullable<MuseLabScriptScene["dialogue"]> = {};
  for (const localeEntry of project.locales) {
    const locale = localeEntry.locale;
    const text = getNodeTextTemplateForLocale(
      bundle.promptsByLocale,
      locale,
      storyId,
      nodeId
    );
    const speaker = getNodeSpeakerForLocale(
      bundle.promptsByLocale,
      locale,
      storyId,
      nodeId
    );
    if (!text && !speaker) continue;
    dialogue[locale] = {};
    if (speaker) dialogue[locale].speaker = speaker;
    if (text) dialogue[locale].dialogue = text;
  }
  return Object.keys(dialogue).length > 0 ? dialogue : undefined;
}

function exportScene(
  bundle: ProjectBundle,
  story: Story,
  project: Project,
  node: StoryNode,
  defaultLocale: string
): MuseLabScriptScene {
  const scene: MuseLabScriptScene = {
    node_name: getNodeDisplayName(node, project),
  };
  if (isUuid(node.id)) {
    scene.node_id = node.id;
  }
  const nodeAttrs = exportAttributes(node.attributes);
  if (nodeAttrs) scene.attributes = nodeAttrs;

  const actors = exportSceneActors(project, node);
  if (actors) scene.actors = actors;

  if (node.backdropId) {
    const backdrop = resolveAssetById(project, node.backdropId);
    scene.backdrop = {
      backdrop_path: getAssetPath(project, backdrop),
    };
    if (isUuid(node.backdropId)) {
      scene.backdrop.backdrop_id = node.backdropId;
    }
  }

  const sound = exportSceneSound(project, node);
  if (sound) scene.sound = sound;

  const dialogue = exportSceneDialogue(bundle, story.id, node.id, project);
  if (dialogue) scene.dialogue = dialogue;

  const options = exportSceneOptions(bundle, story, project, node, defaultLocale);
  if (options) scene.options = options;

  return scene;
}

function collectSceneNodesInOrder(story: Story): StoryNode[] {
  const scenes = story.nodes.filter(isSceneNode);
  const order = new Map<string, number>();
  scenes.forEach((node, index) => order.set(node.id, index));
  return scenes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function exportStoryScript(
  bundle: ProjectBundle,
  storyId: string
): MuseLabStoryScript {
  const { project } = bundle;
  const story = getStory(project, storyId);
  const defaultLocale = getDefaultLocaleTag(project.locales, project.defaultLocale);

  const script: MuseLabStoryScript = {
    format_version: MUSELAB_SCRIPT_FORMAT_VERSION,
    schema: SCRIPT_SCHEMA_ID,
    story_id: story.id,
    story_name: story.name,
    scenes: [],
  };

  const storyPath = getStoryGroupPath(project, story.groupId);
  if (storyPath) script.story_path = storyPath;

  const entryName = getEntrySceneName(story, project);
  if (entryName) script.entry_node_name = entryName;

  if (story.promptStartTemplate) script.prompt_start_template = story.promptStartTemplate;
  if (story.promptEndTemplate) script.prompt_end_template = story.promptEndTemplate;
  if (story.speakerStartTemplate) script.speaker_start_template = story.speakerStartTemplate;
  if (story.speakerEndTemplate) script.speaker_end_template = story.speakerEndTemplate;

  const storyAttrs = exportAttributes(story.attributes);
  if (storyAttrs) script.attributes = storyAttrs;

  script.scenes = collectSceneNodesInOrder(story).map((node) =>
    exportScene(bundle, story, project, node, defaultLocale)
  );

  return script;
}

export function exportProjectScript(bundle: ProjectBundle): MuseLabProjectScript {
  return {
    format_version: MUSELAB_SCRIPT_FORMAT_VERSION,
    schema: SCRIPT_SCHEMA_ID,
    stories: bundle.project.stories.map((story) => exportStoryScript(bundle, story.id)),
  };
}
