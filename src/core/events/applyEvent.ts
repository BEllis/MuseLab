import {
  getStory,
  removeActorExpression as removeActorExpressionInProject,
  removeAsset as removeAssetInProject,
  removeEdge as removeEdgeInProject,
  removeNode as removeNodeInProject,
  removeModule as removeModuleInProject,
  removeStory as removeStoryInProject,
  replaceActorExpressionMedia as replaceActorExpressionMediaInProject,
  replaceAssetMedia as replaceAssetMediaInProject,
  updateActorExpression as updateActorExpressionInProject,
  updateAsset as updateAssetInProject,
  updateEdge as updateEdgeInProject,
  updateNode as updateNodeInProject,
  updateNodePosition as updateNodePositionInProject,
  updateEndNodeLayout as updateEndNodeLayoutInProject,
  updateProject as updateProjectInProject,
  updateModule as updateModuleInProject,
  updateStory as updateStoryInProject,
  removeStoryGroup as removeStoryGroupInProject,
  updateStoryGroup as updateStoryGroupInProject,
  addLocaleToProject,
  removeLocaleFromProject,
} from "@/core/model/project";
import { clearEndNodeLayout } from "@/core/model/endNodeLayout";
import {
  ensureLocalePrompts,
  ensurePromptsForProjectLocales,
  ensureStoryPrompts,
  removeEdgeFromAllLocales,
  removeLocaleFromPrompts,
  removeNodeFromAllLocales,
  removeStoryFromAllLocales,
  setEdgeOptionText,
  setNodeSpeaker,
  setNodeTextTemplate,
} from "@/core/locale/prompts";
import {
  applyNavigationSnapshot,
  applySelectionSnapshot,
  cloneAppState,
  type AppState,
} from "./appState";
import type { AppEvent } from "./types";

export type ApplyDirection = "forward" | "backward";

function cloneNode<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function restoreNodePrompts(
  state: AppState,
  storyId: string,
  nodeId: string,
  promptsByLocale: Record<string, { textTemplate?: string; speaker?: string }>
): void {
  for (const [locale, value] of Object.entries(promptsByLocale)) {
    const prompts = ensureLocalePrompts(state.promptsByLocale, locale);
    const storyPrompts = ensureStoryPrompts(prompts, storyId);
    if (Object.keys(value).length === 0) {
      delete storyPrompts.nodes[nodeId];
      continue;
    }
    storyPrompts.nodes[nodeId] = cloneNode(value);
  }
}

function restoreEdgePrompts(
  state: AppState,
  storyId: string,
  edgeId: string,
  promptsByLocale: Record<string, { optionText?: string }>
): void {
  for (const [locale, value] of Object.entries(promptsByLocale)) {
    const prompts = ensureLocalePrompts(state.promptsByLocale, locale);
    const storyPrompts = ensureStoryPrompts(prompts, storyId);
    if (!value.optionText) {
      delete storyPrompts.edges[edgeId];
      continue;
    }
    storyPrompts.edges[edgeId] = cloneNode(value);
  }
}

function applySingleEvent(state: AppState, event: AppEvent, direction: ApplyDirection): void {
  const useAfter = direction === "forward";

  switch (event.type) {
    case "updateProject":
      updateProjectInProject(state.project, useAfter ? event.after : event.before);
      break;

    case "addLocale": {
      if (useAfter) {
        addLocaleToProject(state.project, event.locale);
        state.promptsByLocale[event.after.locale] = cloneNode(event.after.localePrompts);
      } else {
        removeLocaleFromProject(state.project, event.locale);
        state.promptsByLocale = removeLocaleFromPrompts(state.promptsByLocale, event.locale);
      }
      break;
    }

    case "removeLocale": {
      if (useAfter) {
        removeLocaleFromProject(state.project, event.before.locale);
        state.promptsByLocale = removeLocaleFromPrompts(state.promptsByLocale, event.before.locale);
      } else {
        addLocaleToProject(state.project, event.before.locale);
        state.promptsByLocale[event.before.locale] = cloneNode(event.before.localePrompts);
      }
      break;
    }

    case "addStory": {
      if (useAfter) {
        state.project.stories.push(cloneNode(event.after.story));
        for (const locale of state.project.locales) {
          ensureStoryPrompts(
            ensureLocalePrompts(state.promptsByLocale, locale),
            event.after.story.id
          );
        }
        applyNavigationSnapshot(state, event.after.navigation);
      } else {
        removeStoryFromAllLocales(state.promptsByLocale, event.after.story.id);
        removeStoryInProject(state.project, event.after.story.id);
        applyNavigationSnapshot(state, event.before);
      }
      break;
    }

    case "removeStory": {
      if (useAfter) {
        removeStoryFromAllLocales(state.promptsByLocale, event.before.story.id);
        removeStoryInProject(state.project, event.before.story.id);
        applyNavigationSnapshot(state, event.after);
      } else {
        state.project.stories.push(cloneNode(event.before.story));
        for (const [locale, storyPrompts] of Object.entries(event.before.storyPromptsByLocale)) {
          ensureStoryPrompts(ensureLocalePrompts(state.promptsByLocale, locale), event.before.story.id);
          state.promptsByLocale[locale].stories[event.before.story.id] = cloneNode(storyPrompts);
        }
        applyNavigationSnapshot(state, event.before.navigation);
      }
      break;
    }

    case "updateStory":
      updateStoryInProject(
        state.project,
        event.storyId,
        useAfter ? event.after : event.before
      );
      break;

    case "addStoryGroup": {
      if (useAfter) {
        if (!state.project.storyGroups) {
          state.project.storyGroups = [];
        }
        state.project.storyGroups.push(cloneNode(event.after));
      } else {
        state.project.storyGroups = (state.project.storyGroups ?? []).filter(
          (group) => group.id !== event.after.id
        );
      }
      break;
    }

    case "removeStoryGroup": {
      if (useAfter) {
        removeStoryGroupInProject(state.project, event.before.rootGroupId);
      } else {
        if (!state.project.storyGroups) {
          state.project.storyGroups = [];
        }
        for (const group of event.before.groups) {
          if (!state.project.storyGroups.some((entry) => entry.id === group.id)) {
            state.project.storyGroups.push(cloneNode(group));
          }
        }
        for (const assignment of event.before.storyAssignments) {
          const story = getStory(state.project, assignment.storyId);
          if (assignment.groupId) {
            story.groupId = assignment.groupId;
          } else {
            delete story.groupId;
          }
        }
      }
      break;
    }

    case "updateStoryGroup":
      updateStoryGroupInProject(
        state.project,
        event.groupId,
        useAfter ? event.after : event.before
      );
      break;

    case "addNode": {
      if (useAfter) {
        getStory(state.project, event.storyId).nodes.push(cloneNode(event.after));
      } else {
        removeNodeInProject(state.project, event.storyId, event.after.id);
      }
      break;
    }

    case "cloneNode": {
      if (useAfter) {
        getStory(state.project, event.storyId).nodes.push(cloneNode(event.after.node));
        restoreNodePrompts(
          state,
          event.storyId,
          event.after.node.id,
          event.after.nodePromptsByLocale
        );
      } else {
        removeNodeFromAllLocales(state.promptsByLocale, event.storyId, event.after.node.id);
        removeNodeInProject(state.project, event.storyId, event.after.node.id);
      }
      break;
    }

    case "removeNode": {
      if (useAfter) {
        removeNodeFromAllLocales(state.promptsByLocale, event.storyId, event.before.node.id);
        removeNodeInProject(state.project, event.storyId, event.before.node.id);
      } else {
        const story = getStory(state.project, event.storyId);
        story.nodes.push(cloneNode(event.before.node));
        story.edges.push(...event.before.edges.map(cloneNode));
        if (event.before.entryNodeId) {
          story.entryNodeId = event.before.entryNodeId;
        }
        restoreNodePrompts(
          state,
          event.storyId,
          event.before.node.id,
          event.before.nodePromptsByLocale
        );
      }
      break;
    }

    case "updateNode":
      updateNodeInProject(
        state.project,
        event.storyId,
        event.nodeId,
        useAfter ? event.after : event.before
      );
      break;

    case "updateNodePosition":
      updateNodePositionInProject(
        state.project,
        event.storyId,
        event.nodeId,
        useAfter ? event.after : event.before
      );
      break;

    case "updateEndNodeLayout": {
      if (useAfter) {
        updateEndNodeLayoutInProject(state.project, event.storyId, event.sceneId, event.after);
      } else if (event.before) {
        updateEndNodeLayoutInProject(state.project, event.storyId, event.sceneId, event.before);
      } else {
        clearEndNodeLayout(getStory(state.project, event.storyId), event.sceneId);
      }
      break;
    }

    case "addEdge": {
      if (useAfter) {
        getStory(state.project, event.storyId).edges.push(cloneNode(event.after));
      } else {
        removeEdgeInProject(state.project, event.storyId, event.after.id);
      }
      break;
    }

    case "removeEdge": {
      if (useAfter) {
        removeEdgeFromAllLocales(state.promptsByLocale, event.storyId, event.before.edge.id);
        removeEdgeInProject(state.project, event.storyId, event.before.edge.id);
      } else {
        getStory(state.project, event.storyId).edges.push(cloneNode(event.before.edge));
        restoreEdgePrompts(
          state,
          event.storyId,
          event.before.edge.id,
          event.before.edgePromptsByLocale
        );
      }
      break;
    }

    case "updateEdge":
      updateEdgeInProject(
        state.project,
        event.storyId,
        event.edgeId,
        useAfter ? event.after : event.before
      );
      break;

    case "updateNodePrompt": {
      const prompts = ensureLocalePrompts(state.promptsByLocale, event.locale);
      setNodeTextTemplate(
        prompts,
        event.storyId,
        event.nodeId,
        useAfter ? event.after : event.before
      );
      break;
    }

    case "updateNodeSpeaker": {
      const prompts = ensureLocalePrompts(state.promptsByLocale, event.locale);
      setNodeSpeaker(prompts, event.storyId, event.nodeId, useAfter ? event.after : event.before);
      break;
    }

    case "updateEdgePrompt": {
      const prompts = ensureLocalePrompts(state.promptsByLocale, event.locale);
      setEdgeOptionText(
        prompts,
        event.storyId,
        event.edgeId,
        useAfter ? event.after : event.before
      );
      break;
    }

    case "addAsset":
    case "addBlankActor":
    case "addActorFromImage": {
      if (useAfter) {
        state.project.assets.push(cloneNode(event.after));
      } else {
        removeAssetInProject(state.project, event.after.id);
      }
      break;
    }

    case "updateAsset":
      updateAssetInProject(
        state.project,
        event.assetId,
        useAfter ? event.after : event.before
      );
      break;

    case "replaceAssetMedia":
      replaceAssetMediaInProject(
        state.project,
        event.assetId,
        useAfter ? event.after : event.before
      );
      break;

    case "removeAsset": {
      if (useAfter) {
        removeAssetInProject(state.project, event.before.asset.id);
        applySelectionSnapshot(state, event.after);
      } else {
        state.project.assets.push(cloneNode(event.before.asset));
        applySelectionSnapshot(state, event.before.navigation);
      }
      break;
    }

    case "addActorExpression": {
      if (useAfter) {
        const asset = state.project.assets.find((entry) => entry.id === event.actorId);
        if (asset?.expressions) {
          asset.expressions.push(cloneNode(event.after));
        } else if (asset) {
          asset.expressions = [cloneNode(event.after)];
        }
      } else {
        removeActorExpressionInProject(state.project, event.actorId, event.after.id);
      }
      break;
    }

    case "updateActorExpression":
      updateActorExpressionInProject(
        state.project,
        event.actorId,
        event.expressionId,
        useAfter ? event.after : event.before
      );
      break;

    case "replaceActorExpressionMedia":
      replaceActorExpressionMediaInProject(
        state.project,
        event.actorId,
        event.expressionId,
        useAfter ? event.after : event.before
      );
      break;

    case "removeActorExpression": {
      if (useAfter) {
        removeActorExpressionInProject(state.project, event.actorId, event.before.id);
      } else {
        const asset = state.project.assets.find((entry) => entry.id === event.actorId);
        if (asset) {
          asset.expressions = [...(asset.expressions ?? []), cloneNode(event.before)];
        }
      }
      break;
    }

    case "addModule": {
      if (useAfter) {
        state.project.modules = state.project.modules ?? [];
        state.project.modules.push(cloneNode(event.after.module));
        applySelectionSnapshot(state, event.after.navigation);
      } else {
        removeModuleInProject(state.project, event.after.module.id);
        applySelectionSnapshot(state, event.before);
      }
      break;
    }

    case "removeModule": {
      if (useAfter) {
        removeModuleInProject(state.project, event.before.module.id);
        applySelectionSnapshot(state, event.after);
      } else {
        state.project.modules = state.project.modules ?? [];
        state.project.modules.push(cloneNode(event.before.module));
        applySelectionSnapshot(state, event.before.navigation);
      }
      break;
    }

    case "updateModule":
      updateModuleInProject(
        state.project,
        event.moduleId,
        useAfter ? event.after : event.before
      );
      break;

    case "setActiveStoryId":
      applyNavigationSnapshot(state, useAfter ? event.after : event.before);
      break;

    case "setSelection":
    case "setSelectedAssetId":
    case "setSelectedModuleId":
    case "clearSelection":
      applySelectionSnapshot(state, useAfter ? event.after : event.before);
      break;

    case "setHighlightedRootNodeIds":
      state.highlightedRootNodeIds = [...(useAfter ? event.after : event.before)];
      break;

    case "clearPlayValidationHighlight":
      state.highlightedRootNodeIds = [...(useAfter ? event.after : event.before)];
      break;

    case "batch": {
      const events = direction === "forward" ? event.events : [...event.events].reverse();
      for (const child of events) {
        applySingleEvent(state, child, direction);
      }
      break;
    }
  }
}

export function applyEvent(state: AppState, event: AppEvent, direction: ApplyDirection): AppState {
  const next = cloneAppState(state);
  applySingleEvent(next, event, direction);
  next.promptsByLocale = ensurePromptsForProjectLocales(next.project, next.promptsByLocale);
  return next;
}

export function applyEvents(
  state: AppState,
  events: AppEvent[],
  direction: ApplyDirection
): AppState {
  let next = state;
  const ordered = direction === "forward" ? events : [...events].reverse();
  for (const event of ordered) {
    next = applyEvent(next, event, direction);
  }
  return next;
}
