import { DEFAULT_PROP_Z, type SceneAction } from "./actions";
import { resolvePosition, type StagePosition } from "./positions";
import { taggedTextToPlain } from "./taggedText";

export type SceneSummaryProp = {
  id: string;
  assetId: string;
  variationId?: string;
  position: StagePosition;
  x: number;
  y: number;
  zIndex: number;
};

export type SceneSummary = {
  /** Background left on screen once the scene finishes playing. */
  backgroundAssetId?: string;
  /** Visible props ordered back to front. */
  props: SceneSummaryProp[];
  /** Plain dialogue text with markup stripped, for graph previews. */
  previewText: string;
  /** Last speaker set by the scene, with markup stripped. */
  speaker: string;
};

/**
 * Static end-state of a scene script.
 *
 * Used for canvas thumbnails and node previews, where playing the scene is
 * neither possible nor wanted. Transitions collapse to their final values.
 */
export function summarizeSceneActions(actions: SceneAction[]): SceneSummary {
  let backgroundAssetId: string | undefined;
  const props = new Map<string, SceneSummaryProp & { visible: boolean }>();
  const textParts: string[] = [];
  let speaker = "";

  const plain = (text: string): string => {
    try {
      return taggedTextToPlain(text);
    } catch {
      return text;
    }
  };

  const place = (id: string, position: StagePosition) => {
    const prop = props.get(id);
    if (!prop) return;
    const coords = resolvePosition(position);
    prop.position = position;
    prop.x = coords.x;
    prop.y = coords.y;
  };

  for (const action of actions) {
    switch (action.kind) {
      case "bg.show":
      case "bg.fade":
      case "bg.slideIn":
        backgroundAssetId = action.assetId;
        break;
      case "bg.clear":
      case "bg.slideOut":
        backgroundAssetId = undefined;
        break;

      case "prop.add": {
        const position: StagePosition = { kind: "slot", slot: "Centre" };
        const coords = resolvePosition(position);
        props.set(action.id, {
          id: action.id,
          assetId: action.assetId,
          variationId: action.variationId,
          position,
          x: coords.x,
          y: coords.y,
          zIndex: DEFAULT_PROP_Z,
          visible: false,
        });
        break;
      }
      case "prop.remove":
        props.delete(action.id);
        break;
      case "prop.show":
      case "prop.fadeIn":
      case "prop.slideIn": {
        const prop = props.get(action.id);
        if (!prop) break;
        if (action.kind !== "prop.slideIn" && action.position) place(action.id, action.position);
        if (action.kind === "prop.slideIn") place(action.id, action.position);
        prop.visible = true;
        break;
      }
      case "prop.hide":
      case "prop.fadeOut":
      case "prop.slideOut": {
        const prop = props.get(action.id);
        if (prop) prop.visible = false;
        break;
      }
      case "prop.move":
      case "prop.setPosition":
        place(action.id, action.position);
        break;
      case "prop.setZ": {
        const prop = props.get(action.id);
        if (prop) prop.zIndex = Math.trunc(action.z);
        break;
      }
      case "prop.setVariation": {
        const prop = props.get(action.id);
        if (prop) prop.variationId = action.variationId;
        break;
      }

      case "dialogue.revealText":
        textParts.push(plain(action.text));
        break;
      case "dialogue.setSpeaker":
        speaker = plain(action.text);
        break;
      case "dialogue.clear":
      case "dialogue.reset":
        textParts.length = 0;
        if (action.kind === "dialogue.reset") speaker = "";
        break;

      default:
        break;
    }
  }

  return {
    backgroundAssetId,
    props: [...props.values()]
      .filter((prop) => prop.visible)
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
      .map(({ visible: _visible, ...prop }) => prop),
    previewText: textParts.join(" ").replace(/\s+/g, " ").trim(),
    speaker,
  };
}
