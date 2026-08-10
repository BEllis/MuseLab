import type { Direction, StagePosition } from "./positions";

/** Default z layer for props added without an explicit SetZ. */
export const DEFAULT_PROP_Z = 100;

/** Dialogue channel used when an action does not name one. */
export const DEFAULT_DIALOGUE_CHANNEL = "main";

export type RevealSpec =
  | { mode: "instant" }
  | { mode: "charsPerSecond"; rate: number }
  | { mode: "wordsPerSecond"; rate: number }
  | { mode: "charsOverTime"; durationMs: number }
  | { mode: "wordsOverTime"; durationMs: number };

export type SceneAction =
  // Background
  | { kind: "bg.show"; assetId: string }
  | { kind: "bg.clear" }
  | { kind: "bg.fade"; assetId: string; durationMs: number }
  | { kind: "bg.slideIn"; assetId: string; direction: Direction; durationMs: number }
  | { kind: "bg.slideOut"; direction: Direction; durationMs: number }
  // Props (characters and props share one system)
  | { kind: "prop.add"; id: string; assetId: string; variationId?: string }
  | { kind: "prop.remove"; id: string }
  | { kind: "prop.show"; id: string; position?: StagePosition }
  | { kind: "prop.hide"; id: string }
  | { kind: "prop.fadeIn"; id: string; position?: StagePosition; durationMs: number }
  | { kind: "prop.fadeOut"; id: string; durationMs: number }
  | {
      kind: "prop.slideIn";
      id: string;
      position: StagePosition;
      direction: Direction;
      durationMs: number;
    }
  | { kind: "prop.slideOut"; id: string; direction: Direction; durationMs: number }
  | { kind: "prop.move"; id: string; position: StagePosition; durationMs: number }
  | { kind: "prop.setPosition"; id: string; position: StagePosition }
  | { kind: "prop.setZ"; id: string; z: number }
  | { kind: "prop.setVariation"; id: string; variationId: string }
  // Dialogue
  | { kind: "dialogue.show"; channel: string }
  | { kind: "dialogue.hide"; channel: string }
  | { kind: "dialogue.setSpeaker"; text: string }
  | { kind: "dialogue.revealText"; channel: string; text: string; reveal: RevealSpec }
  | { kind: "dialogue.clear" }
  | { kind: "dialogue.reset" }
  // Control
  | { kind: "wait"; milliseconds: number }
  | { kind: "waitForContinue" }
  // Audio
  | {
      kind: "playSound";
      assetId: string;
      delaySeconds: number;
      startTime?: number;
      endTime?: number;
    }
  // Runtime state
  | { kind: "rt.setBool"; key: string; value: boolean }
  | { kind: "rt.setInt"; key: string; value: number }
  | { kind: "rt.setString"; key: string; value: string }
  | { kind: "rt.emit"; eventName: string };

export type SceneActionKind = SceneAction["kind"];

export const SCENE_ACTION_KINDS: SceneActionKind[] = [
  "bg.show",
  "bg.clear",
  "bg.fade",
  "bg.slideIn",
  "bg.slideOut",
  "prop.add",
  "prop.remove",
  "prop.show",
  "prop.hide",
  "prop.fadeIn",
  "prop.fadeOut",
  "prop.slideIn",
  "prop.slideOut",
  "prop.move",
  "prop.setPosition",
  "prop.setZ",
  "prop.setVariation",
  "dialogue.show",
  "dialogue.hide",
  "dialogue.setSpeaker",
  "dialogue.revealText",
  "dialogue.clear",
  "dialogue.reset",
  "wait",
  "waitForContinue",
  "playSound",
  "rt.setBool",
  "rt.setInt",
  "rt.setString",
  "rt.emit",
];

export type SceneActionGroup = "background" | "prop" | "dialogue" | "control" | "audio" | "state";

export function sceneActionGroup(kind: SceneActionKind): SceneActionGroup {
  if (kind.startsWith("bg.")) return "background";
  if (kind.startsWith("prop.")) return "prop";
  if (kind.startsWith("dialogue.")) return "dialogue";
  if (kind.startsWith("rt.")) return "state";
  if (kind === "playSound") return "audio";
  return "control";
}

/** True when the action needs a prop that was previously added. */
export function requiresExistingProp(action: SceneAction): action is Extract<
  SceneAction,
  { id: string }
> {
  return action.kind.startsWith("prop.") && action.kind !== "prop.add";
}

export function defaultRevealSpec(): RevealSpec {
  return { mode: "charsPerSecond", rate: -1 };
}

export function createSceneAction(kind: SceneActionKind): SceneAction {
  switch (kind) {
    case "bg.show":
      return { kind, assetId: "" };
    case "bg.clear":
      return { kind };
    case "bg.fade":
      return { kind, assetId: "", durationMs: 500 };
    case "bg.slideIn":
      return { kind, assetId: "", direction: "Right", durationMs: 500 };
    case "bg.slideOut":
      return { kind, direction: "Left", durationMs: 500 };
    case "prop.add":
      return { kind, id: "", assetId: "" };
    case "prop.remove":
      return { kind, id: "" };
    case "prop.show":
      return { kind, id: "" };
    case "prop.hide":
      return { kind, id: "" };
    case "prop.fadeIn":
      return { kind, id: "", durationMs: 400 };
    case "prop.fadeOut":
      return { kind, id: "", durationMs: 400 };
    case "prop.slideIn":
      return {
        kind,
        id: "",
        position: { kind: "slot", slot: "Centre" },
        direction: "Left",
        durationMs: 500,
      };
    case "prop.slideOut":
      return { kind, id: "", direction: "Left", durationMs: 500 };
    case "prop.move":
      return { kind, id: "", position: { kind: "slot", slot: "Centre" }, durationMs: 400 };
    case "prop.setPosition":
      return { kind, id: "", position: { kind: "slot", slot: "Centre" } };
    case "prop.setZ":
      return { kind, id: "", z: DEFAULT_PROP_Z };
    case "prop.setVariation":
      return { kind, id: "", variationId: "" };
    case "dialogue.show":
      return { kind, channel: DEFAULT_DIALOGUE_CHANNEL };
    case "dialogue.hide":
      return { kind, channel: DEFAULT_DIALOGUE_CHANNEL };
    case "dialogue.setSpeaker":
      return { kind, text: "" };
    case "dialogue.revealText":
      return {
        kind,
        channel: DEFAULT_DIALOGUE_CHANNEL,
        text: "",
        reveal: defaultRevealSpec(),
      };
    case "dialogue.clear":
      return { kind };
    case "dialogue.reset":
      return { kind };
    case "wait":
      return { kind, milliseconds: 500 };
    case "waitForContinue":
      return { kind };
    case "playSound":
      return { kind, assetId: "", delaySeconds: 0 };
    case "rt.setBool":
      return { kind, key: "", value: true };
    case "rt.setInt":
      return { kind, key: "", value: 0 };
    case "rt.setString":
      return { kind, key: "", value: "" };
    case "rt.emit":
      return { kind, eventName: "" };
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown scene action kind: ${String(exhaustive)}`);
    }
  }
}
