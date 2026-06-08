import type { Project, Story, StoryNode, StoryEdge } from "../model/types";
import type { PromptsByLocale } from "../locale/prompts";
import {
  getEdgeOptionTextForLocale,
  getNodeSpeakerForLocale,
  getNodeTextTemplateForLocale,
} from "../locale/prompts";
import { getPlayEntryNodeId } from "../model/graphHierarchy";
import { runTemplate, evaluateCondition } from "../template/engine";
import type { TemplateContext } from "../cito/runtimeBridge";

export interface RuntimeChoice {
  edge: StoryEdge;
  targetNode: StoryNode;
  optionText?: string;
}

export interface RuntimeState {
  currentNodeId: string | null;
  state: Record<string, unknown>;
  /** Rendered HTML for current node */
  currentHtml: string;
  /** Rendered speaker name for current node (empty when unset) */
  currentSpeaker: string;
  /** Out-edges from current node that pass their condition */
  choices: RuntimeChoice[];
}

export type EventCallback = (eventName: string) => void;
export type CallHandler = (name: string, ...args: unknown[]) => unknown;
export type PlaySoundHandler = (
  assetId: string,
  options?: { startTime?: number; endTime?: number }
) => void;

export function createRunner(
  project: Project,
  story: Story,
  storyId: string,
  promptsByLocale: PromptsByLocale,
  initialLocale: string,
  callbacks: {
    onEmit?: EventCallback;
    onCall?: CallHandler;
    onPlaySound?: PlaySoundHandler;
  } = {}
) {
  let activeLocale = initialLocale;
  const state: Record<string, unknown> = { ...story.globalState };
  let currentNodeId: string | null = getPlayEntryNodeId(story);

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

  function getCurrentNode(): StoryNode | null {
    if (!currentNodeId) return null;
    return story.nodes.find((n) => n.id === currentNodeId) ?? null;
  }

  function getOutEdges(): StoryEdge[] {
    if (!currentNodeId) return [];
    return story.edges.filter((e) => e.sourceNodeId === currentNodeId);
  }

  async function getChoices(): Promise<RuntimeChoice[]> {
    const edges = getOutEdges();
    const choices: RuntimeChoice[] = [];
    for (const edge of edges) {
      if (!(await evaluateCondition(edge.condition, { state }))) continue;
      const targetNode = story.nodes.find((n) => n.id === edge.targetNodeId);
      if (targetNode) {
        choices.push({
          edge,
          targetNode,
          optionText: getEdgeOptionTextForLocale(
            promptsByLocale,
            activeLocale,
            storyId,
            edge.id
          ),
        });
      }
    }
    return choices;
  }

  async function renderCurrentNode(): Promise<string> {
    if (!currentNodeId) return "";
    const textTemplate = getNodeTextTemplateForLocale(
      promptsByLocale,
      activeLocale,
      storyId,
      currentNodeId
    );
    return runTemplate(textTemplate, context);
  }

  async function renderCurrentSpeaker(): Promise<string> {
    if (!currentNodeId) return "";
    const speaker = getNodeSpeakerForLocale(
      promptsByLocale,
      activeLocale,
      storyId,
      currentNodeId
    );
    if (!speaker) return "";
    return runTemplate(speaker, context);
  }

  async function getRuntimeState(): Promise<RuntimeState> {
    const node = getCurrentNode();
    const [html, speaker, choices] = await Promise.all([
      node ? renderCurrentNode() : Promise.resolve(""),
      node ? renderCurrentSpeaker() : Promise.resolve(""),
      getChoices(),
    ]);
    return {
      currentNodeId,
      state: { ...state },
      currentHtml: html,
      currentSpeaker: speaker,
      choices,
    };
  }

  function goToNode(nodeId: string): void {
    currentNodeId = nodeId;
  }

  function getSoundConfigsForCurrentNode(): StoryNode["soundConfigs"] {
    const node = getCurrentNode();
    return node?.soundConfigs ?? [];
  }

  return {
    get project() {
      return project;
    },
    get story() {
      return story;
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
    getChoices,
    getSoundConfigsForCurrentNode,
    context,
  };
}

export type Runner = ReturnType<typeof createRunner>;
