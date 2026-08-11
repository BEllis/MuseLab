import type { Asset, Project } from "../model/types";
import type { SceneAction } from "./actions";
import { isVectorInBounds, STAGE_HEIGHT, STAGE_WIDTH, type StagePosition } from "./positions";
import { validateDialogueTextIssues } from "./dialogueText";

export type SceneActionIssue = {
  index: number;
  message: string;
};

export type ValidateSceneActionsOptions = {
  project?: Project;
};

function positionIssue(position: StagePosition | undefined): string | null {
  if (!position || position.kind !== "vec") return null;
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return "Position coordinates must be numbers.";
  }
  if (!isVectorInBounds(position.x, position.y)) {
    return `Position (${position.x}, ${position.y}) is outside the stage. x must be 0-${STAGE_WIDTH} and y must be 0-${STAGE_HEIGHT}.`;
  }
  return null;
}

function durationIssue(durationMs: number): string | null {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "Duration must be zero or a positive number of milliseconds.";
  }
  return null;
}

function findAsset(project: Project | undefined, assetId: string): Asset | undefined {
  return project?.assets.find((asset) => asset.id === assetId);
}

function assetIssue(
  project: Project | undefined,
  assetId: string,
  expected: Asset["type"] | Asset["type"][]
): string | null {
  if (!assetId) return "Choose an asset.";
  if (!project) return null;
  const asset = findAsset(project, assetId);
  if (!asset) return `Unknown asset "${assetId}".`;
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(asset.type)) {
    return `Asset "${asset.name}" is a ${asset.type}; expected ${allowed.join(" or ")}.`;
  }
  return null;
}

function variationIssue(
  project: Project | undefined,
  assetId: string,
  variationId: string
): string | null {
  if (!project || !variationId) return null;
  const asset = findAsset(project, assetId);
  if (!asset) return null;
  const expressions = asset.expressions ?? [];
  if (expressions.length === 0) return null;
  if (!expressions.some((expression) => expression.id === variationId)) {
    return `Asset "${asset.name}" has no variation "${variationId}".`;
  }
  return null;
}

/**
 * Statically validate an ordered action list.
 *
 * Prop lifetime is tracked across the list so showing or moving a prop that was
 * never added is reported in the editor rather than at play time.
 */
export function validateSceneActions(
  actions: SceneAction[],
  options: ValidateSceneActionsOptions = {}
): SceneActionIssue[] {
  const { project } = options;
  const issues: SceneActionIssue[] = [];
  const activeProps = new Map<string, { assetId: string }>();

  const push = (index: number, message: string | null) => {
    if (message) issues.push({ index, message });
  };

  const requireProp = (index: number, id: string, verb: string): boolean => {
    if (!id) {
      push(index, "Enter the prop instance id.");
      return false;
    }
    if (!activeProps.has(id)) {
      push(
        index,
        `Cannot ${verb} prop '${id}': no active prop with this ID exists. Add the prop before ${verb === "remove" ? "removing" : `${verb}ing`} it.`
      );
      return false;
    }
    return true;
  };

  actions.forEach((action, index) => {
    switch (action.kind) {
      case "bg.show":
        push(index, assetIssue(project, action.assetId, "backdrop"));
        break;
      case "bg.fade":
        push(index, assetIssue(project, action.assetId, "backdrop"));
        push(index, durationIssue(action.durationMs));
        break;
      case "bg.slideIn":
        push(index, assetIssue(project, action.assetId, "backdrop"));
        push(index, durationIssue(action.durationMs));
        break;
      case "bg.slideOut":
        push(index, durationIssue(action.durationMs));
        break;
      case "bg.clear":
        break;

      case "prop.add": {
        if (!action.id) {
          push(index, "Enter a prop instance id.");
          break;
        }
        if (activeProps.has(action.id)) {
          push(
            index,
            `Prop '${action.id}' already exists in this scene. Use a different instance id or remove it first.`
          );
          break;
        }
        push(index, assetIssue(project, action.assetId, ["actor", "backdrop"]));
        if (action.variationId) {
          push(index, variationIssue(project, action.assetId, action.variationId));
        }
        activeProps.set(action.id, { assetId: action.assetId });
        break;
      }
      case "prop.remove":
        if (requireProp(index, action.id, "remove")) {
          activeProps.delete(action.id);
        }
        break;
      case "prop.show":
        requireProp(index, action.id, "show");
        push(index, positionIssue(action.position));
        break;
      case "prop.hide":
        requireProp(index, action.id, "hide");
        break;
      case "prop.fadeIn":
        requireProp(index, action.id, "fade in");
        push(index, positionIssue(action.position));
        push(index, durationIssue(action.durationMs));
        break;
      case "prop.fadeOut":
        requireProp(index, action.id, "fade out");
        push(index, durationIssue(action.durationMs));
        break;
      case "prop.slideIn":
        requireProp(index, action.id, "slide in");
        push(index, positionIssue(action.position));
        push(index, durationIssue(action.durationMs));
        break;
      case "prop.slideOut":
        requireProp(index, action.id, "slide out");
        push(index, durationIssue(action.durationMs));
        break;
      case "prop.move":
        requireProp(index, action.id, "move");
        push(index, positionIssue(action.position));
        push(index, durationIssue(action.durationMs));
        break;
      case "prop.setPosition":
        requireProp(index, action.id, "position");
        push(index, positionIssue(action.position));
        break;
      case "prop.setZ":
        if (requireProp(index, action.id, "set the z layer of") && !Number.isFinite(action.z)) {
          push(index, "Z layer must be a number.");
        }
        break;
      case "prop.setVariation": {
        if (requireProp(index, action.id, "set the variation of")) {
          if (!action.variationId) {
            push(index, "Choose a variation.");
          } else {
            const entry = activeProps.get(action.id);
            push(index, variationIssue(project, entry?.assetId ?? "", action.variationId));
          }
        }
        break;
      }
      case "prop.highlight":
        requireProp(index, action.id, "highlight");
        break;
      case "prop.unhighlight":
        requireProp(index, action.id, "remove the highlight from");
        break;

      case "dialogue.revealText": {
        for (const issue of validateDialogueTextIssues(action.text, project)) {
          push(index, issue.message);
        }
        if (action.reveal.mode === "charsOverTime" || action.reveal.mode === "wordsOverTime") {
          push(index, durationIssue(action.reveal.durationMs));
        }
        break;
      }
      case "dialogue.setSpeaker":
        for (const issue of validateDialogueTextIssues(action.text, project)) {
          push(index, issue.message);
        }
        break;
      case "dialogue.show":
        if (action.characterId) {
          push(index, assetIssue(project, action.characterId, "actor"));
        }
        break;
      case "dialogue.hide":
        break;
      case "dialogue.setWidth":
        if (
          !Number.isInteger(action.widthPercent) ||
          action.widthPercent < 1 ||
          action.widthPercent > 100
        ) {
          push(index, "Dialogue width must be an integer from 1 to 100 percent.");
        }
        break;
      case "dialogue.clear":
      case "dialogue.reset":
        break;

      case "wait":
        push(index, durationIssue(action.milliseconds));
        break;
      case "waitForContinue":
        break;

      case "playSound":
        push(index, assetIssue(project, action.assetId, "sound"));
        break;

      case "rt.setBool":
      case "rt.setInt":
      case "rt.setString":
        if (!action.key) push(index, "Enter a state key.");
        break;
      case "rt.emit":
        if (!action.eventName) push(index, "Enter an event name.");
        break;

      default: {
        const exhaustive: never = action;
        void exhaustive;
      }
    }
  });

  return issues;
}

export function assertValidSceneActions(
  actions: SceneAction[],
  options: ValidateSceneActionsOptions = {}
): void {
  const issues = validateSceneActions(actions, options);
  if (issues.length === 0) return;
  const detail = issues
    .map((issue) => `  #${issue.index + 1}: ${issue.message}`)
    .join("\n");
  throw new Error(`Scene actions are invalid:\n${detail}`);
}
