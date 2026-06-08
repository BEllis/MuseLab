import type { Project, Story, StoryNode, StoryEdge } from "../model/types";
import type { PromptsByLocale } from "../locale/prompts";
import {
  getEdgeOptionTextForLocale,
  getNodeSpeakerForLocale,
  getNodeTextTemplateForLocale,
} from "../locale/prompts";
import { isJumpNode, isSceneNode, isStartNode } from "../model/nodeTypes";
import { getStory } from "../model/project";
import { runTemplate, evaluateCondition } from "../template/engine";
import type { TemplateContext } from "../cito/runtimeBridge";

export interface RuntimeChoice {
  edge: StoryEdge;
  targetNode: StoryNode;
  optionText?: string;
}

export interface RuntimeState {
  currentNodeId: string | null;
  activeStoryId: string;
  state: Record<string, unknown>;
  /** Rendered HTML for current node */
  currentHtml: string;
  /** Rendered speaker name for current node (empty when unset) */
  currentSpeaker: string;
  /** Out-edges from current node that pass their condition */
  choices: RuntimeChoice[];
  /** True when on a scene with no continuation (player should confirm to finish) */
  isTerminalScene: boolean;
  /** True when the player has finished the story */
  isEnded: boolean;
}

export type EventCallback = (eventName: string) => void;
export type CallHandler = (name: string, ...args: unknown[]) => unknown;
export type PlaySoundHandler = (
  assetId: string,
  options?: { startTime?: number; endTime?: number }
) => void;

function resolveJumpTarget(
  project: Project,
  node: StoryNode
): { storyId: string; startNodeId: string } {
  if (!isJumpNode(node)) {
    throw new Error("resolveJumpTarget called on non-jump node");
  }
  if (!node.jumpTargetStoryId || !node.jumpTargetStartNodeId) {
    throw new Error("Jump node is missing a target story or Start node");
  }
  const targetStory = getStory(project, node.jumpTargetStoryId);
  const targetStart = targetStory.nodes.find((entry) => entry.id === node.jumpTargetStartNodeId);
  if (!targetStart || !isStartNode(targetStart)) {
    throw new Error("Jump target is not a valid Start node");
  }
  return {
    storyId: node.jumpTargetStoryId,
    startNodeId: node.jumpTargetStartNodeId,
  };
}

function sceneHasOutgoingContinuation(story: Story, sceneId: string): boolean {
  return story.edges.some((edge) => {
    if (edge.sourceNodeId !== sceneId) return false;
    const target = story.nodes.find((node) => node.id === edge.targetNodeId);
    return target != null && (isSceneNode(target) || isJumpNode(target));
  });
}

export function createRunner(
  project: Project,
  initialStoryId: string,
  initialNodeId: string,
  promptsByLocale: PromptsByLocale,
  initialLocale: string,
  callbacks: {
    onEmit?: EventCallback;
    onCall?: CallHandler;
    onPlaySound?: PlaySoundHandler;
  } = {}
) {
  let activeLocale = initialLocale;
  let activeStoryId = initialStoryId;
  let activeStory = getStory(project, activeStoryId);
  const state: Record<string, unknown> = { ...activeStory.globalState };
  let currentNodeId: string | null = initialNodeId;
  let isEnded = false;

  function setActiveLocale(locale: string): void {
    activeLocale = locale;
  }

  const setState: TemplateContext["setState"] = (path, value) => {
    state[path] = value;
  };

  const emit: TemplateContext["emit"] = (eventName) => {
    callbacks.onEmit?.(eventName);
  };

  const call: TemplateContext["call"] = (name, ...args) => {
    return callbacks.onCall?.(name, ...args);
  };

  const playSound: TemplateContext["playSound"] = (assetId, options) => {
    callbacks.onPlaySound?.(assetId, options);
  };

  const context: TemplateContext = {
    state,
    setState,
    emit,
    call,
    playSound,
  };

  function switchStory(storyId: string, nodeId: string): void {
    activeStoryId = storyId;
    activeStory = getStory(project, storyId);
    Object.assign(state, activeStory.globalState);
    currentNodeId = nodeId;
    isEnded = false;
  }

  function getCurrentNode(): StoryNode | null {
    if (!currentNodeId) return null;
    return activeStory.nodes.find((n) => n.id === currentNodeId) ?? null;
  }

  function getOutEdges(): StoryEdge[] {
    if (!currentNodeId) return [];
    return activeStory.edges.filter((e) => e.sourceNodeId === currentNodeId);
  }

  async function getChoices(): Promise<RuntimeChoice[]> {
    const node = getCurrentNode();
    if (!node || (!isSceneNode(node) && !isStartNode(node))) return [];

    const edges = getOutEdges();
    const choices: RuntimeChoice[] = [];
    for (const edge of edges) {
      if (!(await evaluateCondition(edge.condition, { state }))) continue;
      const targetNode = activeStory.nodes.find((n) => n.id === edge.targetNodeId);
      if (!targetNode) continue;

      if (isSceneNode(node) && isSceneNode(targetNode)) {
        choices.push({
          edge,
          targetNode,
          optionText: getEdgeOptionTextForLocale(
            promptsByLocale,
            activeLocale,
            activeStoryId,
            edge.id
          ),
        });
        continue;
      }

      if (
        (isStartNode(node) || isSceneNode(node)) &&
        (isSceneNode(targetNode) || isJumpNode(targetNode))
      ) {
        choices.push({
          edge,
          targetNode,
          optionText: isSceneNode(targetNode)
            ? getEdgeOptionTextForLocale(
                promptsByLocale,
                activeLocale,
                activeStoryId,
                edge.id
              )
            : undefined,
        });
      }
    }
    return choices;
  }

  async function renderCurrentNode(): Promise<string> {
    if (!currentNodeId) return "";
    const node = getCurrentNode();
    if (!node || !isSceneNode(node)) return "";
    const textTemplate = getNodeTextTemplateForLocale(
      promptsByLocale,
      activeLocale,
      activeStoryId,
      currentNodeId
    );
    return runTemplate(textTemplate, context);
  }

  async function renderCurrentSpeaker(): Promise<string> {
    if (!currentNodeId) return "";
    const node = getCurrentNode();
    if (!node || !isSceneNode(node)) return "";
    const speaker = getNodeSpeakerForLocale(
      promptsByLocale,
      activeLocale,
      activeStoryId,
      currentNodeId
    );
    if (!speaker) return "";
    return runTemplate(speaker, context);
  }

  async function getRuntimeState(): Promise<RuntimeState> {
    const node = getCurrentNode();
    const [html, speaker, choices] = await Promise.all([
      node && isSceneNode(node) ? renderCurrentNode() : Promise.resolve(""),
      node && isSceneNode(node) ? renderCurrentSpeaker() : Promise.resolve(""),
      getChoices(),
    ]);

    const isTerminalScene =
      node != null &&
      isSceneNode(node) &&
      choices.length === 0 &&
      !sceneHasOutgoingContinuation(activeStory, node.id);

    return {
      currentNodeId,
      activeStoryId,
      state: { ...state },
      currentHtml: html,
      currentSpeaker: speaker,
      choices,
      isTerminalScene,
      isEnded,
    };
  }

  function finishStory(): void {
    isEnded = true;
  }

  function goToNode(nodeId: string): void {
    const node = activeStory.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      throw new Error(`Node "${nodeId}" not found in story "${activeStoryId}"`);
    }

    if (isJumpNode(node)) {
      const target = resolveJumpTarget(project, node);
      switchStory(target.storyId, target.startNodeId);
      return;
    }

    currentNodeId = nodeId;
    isEnded = false;
  }

  function getSoundConfigsForCurrentNode(): StoryNode["soundConfigs"] {
    const node = getCurrentNode();
    if (!node || !isSceneNode(node)) return [];
    return node.soundConfigs ?? [];
  }

  return {
    get project() {
      return project;
    },
    get story() {
      return activeStory;
    },
    get activeStoryId() {
      return activeStoryId;
    },
    get activeLocale() {
      return activeLocale;
    },
    setActiveLocale,
    get state() {
      return state;
    },
    get currentNodeId() {
      return currentNodeId;
    },
    getCurrentNode,
    getRuntimeState,
    goToNode,
    finishStory,
    getChoices,
    getSoundConfigsForCurrentNode,
    context,
  };
}

export type Runner = ReturnType<typeof createRunner>;
