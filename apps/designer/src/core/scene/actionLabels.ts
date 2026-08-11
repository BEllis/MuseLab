import {
  sceneActionGroup,
  type SceneActionGroup,
  type SceneActionKind,
} from "./actions";

const LABELS: Record<SceneActionKind, string> = {
  "bg.show": "Show background",
  "bg.clear": "Clear background",
  "bg.fade": "Fade background",
  "bg.slideIn": "Slide background in",
  "bg.slideOut": "Slide background out",
  "prop.add": "Add prop",
  "prop.remove": "Remove prop",
  "prop.show": "Show prop",
  "prop.hide": "Hide prop",
  "prop.fadeIn": "Fade prop in",
  "prop.fadeOut": "Fade prop out",
  "prop.slideIn": "Slide prop in",
  "prop.slideOut": "Slide prop out",
  "prop.move": "Move prop",
  "prop.setPosition": "Set prop position",
  "prop.setZ": "Set prop layer",
  "prop.setVariation": "Set prop variation",
  "prop.highlight": "Highlight prop",
  "prop.unhighlight": "Remove highlight",
  "dialogue.show": "Show dialogue box",
  "dialogue.hide": "Hide dialogue box",
  "dialogue.setWidth": "Set dialogue width",
  "dialogue.setSpeaker": "Set speaker",
  "dialogue.revealText": "Say",
  "dialogue.clear": "Clear dialogue",
  "dialogue.reset": "Reset dialogue",
  wait: "Wait",
  waitForContinue: "Wait for continue",
  playSound: "Play sound",
  "rt.setBool": "Set flag",
  "rt.setInt": "Set number",
  "rt.setString": "Set text",
  "rt.emit": "Emit event",
};

const GROUP_LABELS: Record<SceneActionGroup, string> = {
  background: "Background",
  prop: "Props",
  dialogue: "Dialogue",
  control: "Timing",
  audio: "Audio",
  state: "State",
};

const GROUP_COLORS: Record<SceneActionGroup, string> = {
  background: "#2b6cb0",
  prop: "#2f855a",
  dialogue: "#6b46c1",
  control: "#975a16",
  audio: "#b83280",
  state: "#4a5568",
};

export function sceneActionLabel(kind: SceneActionKind): string {
  return LABELS[kind];
}

export function sceneActionGroupLabel(group: SceneActionGroup): string {
  return GROUP_LABELS[group];
}

export function sceneActionGroupColor(kind: SceneActionKind): string {
  return GROUP_COLORS[sceneActionGroup(kind)];
}

export const SCENE_ACTION_GROUP_ORDER: SceneActionGroup[] = [
  "dialogue",
  "prop",
  "background",
  "control",
  "audio",
  "state",
];
