import type { Project, StoryNode, StoryEdge } from "../model/types";
import type { PromptsByLocale } from "../locale/prompts";
import { getEdgeOptionTextForLocale, getNodeTextTemplateForLocale } from "../locale/prompts";
import { getEntryNodeId } from "../model/project";
import { runTemplate, evaluateCondition } from "../template/engine";
import type { TemplateContext } from "../template/sandbox";

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
  promptsByLocale: PromptsByLocale,
  activeLocale: string,
  callbacks: {
    onEmit?: EventCallback;
    onCall?: CallHandler;
    onPlaySound?: PlaySoundHandler;
  } = {}
) {
  const state: Record<string, unknown> = { ...project.globalState };
  let currentNodeId: string | null = getEntryNodeId(project);

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
    return project.nodes.find((n) => n.id === currentNodeId) ?? null;
  }

  function getOutEdges(): StoryEdge[] {
    if (!currentNodeId) return [];
    return project.edges.filter((e) => e.sourceNodeId === currentNodeId);
  }

  function getChoices(): RuntimeChoice[] {
    const edges = getOutEdges();
    const choices: RuntimeChoice[] = [];
    for (const edge of edges) {
      if (!evaluateCondition(edge.condition, { state })) continue;
      const targetNode = project.nodes.find((n) => n.id === edge.targetNodeId);
      if (targetNode) {
        choices.push({
          edge,
          targetNode,
          optionText: getEdgeOptionTextForLocale(promptsByLocale, activeLocale, edge.id),
        });
      }
    }
    return choices;
  }

  function renderCurrentNode(): string {
    if (!currentNodeId) return "";
    const textTemplate = getNodeTextTemplateForLocale(
      promptsByLocale,
      activeLocale,
      currentNodeId
    );
    return runTemplate(textTemplate, context);
  }

  function getRuntimeState(): RuntimeState {
    const node = getCurrentNode();
    const html = node ? renderCurrentNode() : "";
    return {
      currentNodeId,
      state: { ...state },
      currentHtml: html,
      choices: getChoices(),
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
    get activeLocale() {
      return activeLocale;
    },
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
