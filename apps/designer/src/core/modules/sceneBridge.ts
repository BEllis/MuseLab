import type { PromptInstructionRecorder } from "@/core/prompt/promptInstructions";
import {
  isDirection,
  isPositionSlot,
  type Direction,
  type StagePosition,
} from "@/core/scene/positions";
import { SceneActionError } from "@/core/scene/sceneDirector";

function toDirection(value: string): Direction {
  if (!isDirection(value)) {
    throw new SceneActionError(
      `Unknown direction "${value}". Use Left, Right, Top, Bottom, TopLeft, TopRight, BottomLeft, or BottomRight.`
    );
  }
  return value;
}

function toSlotPosition(value: string): StagePosition {
  if (!isPositionSlot(value)) {
    throw new SceneActionError(
      `Unknown position "${value}". Use a named slot such as Left, Centre, or BottomRight, or supply x/y coordinates.`
    );
  }
  return { kind: "slot", slot: value };
}

function toVectorPosition(x: number, y: number): StagePosition {
  return { kind: "vec", x, y };
}

/** Cito `bg` binding: records background operations into the prompt stream. */
export function createBackgroundBridge(recorder: PromptInstructionRecorder) {
  const api = {
    show: (assetId: string) => recorder.scene({ kind: "bg.show", assetId }),
    clear: () => recorder.scene({ kind: "bg.clear" }),
    fade: (assetId: string, durationMs: number) =>
      recorder.scene({ kind: "bg.fade", assetId, durationMs }),
    slideIn: (assetId: string, direction: string, durationMs: number) =>
      recorder.scene({
        kind: "bg.slideIn",
        assetId,
        direction: toDirection(direction),
        durationMs,
      }),
    slideOut: (direction: string, durationMs: number) =>
      recorder.scene({ kind: "bg.slideOut", direction: toDirection(direction), durationMs }),
  };

  return {
    ...api,
    Show: api.show,
    Clear: api.clear,
    Fade: api.fade,
    SlideIn: api.slideIn,
    SlideOut: api.slideOut,
  };
}

/** Cito `prop` binding: records foreground object operations into the prompt stream. */
export function createPropBridge(recorder: PromptInstructionRecorder) {
  const api = {
    add: (id: string, assetId: string) => recorder.scene({ kind: "prop.add", id, assetId }),
    addVariant: (id: string, assetId: string, variationId: string) =>
      recorder.scene({ kind: "prop.add", id, assetId, variationId }),
    remove: (id: string) => recorder.scene({ kind: "prop.remove", id }),
    show: (id: string) => recorder.scene({ kind: "prop.show", id }),
    showAt: (id: string, slot: string) =>
      recorder.scene({ kind: "prop.show", id, position: toSlotPosition(slot) }),
    showAtXY: (id: string, x: number, y: number) =>
      recorder.scene({ kind: "prop.show", id, position: toVectorPosition(x, y) }),
    hide: (id: string) => recorder.scene({ kind: "prop.hide", id }),
    fadeIn: (id: string, durationMs: number) =>
      recorder.scene({ kind: "prop.fadeIn", id, durationMs }),
    fadeInAt: (id: string, slot: string, durationMs: number) =>
      recorder.scene({
        kind: "prop.fadeIn",
        id,
        position: toSlotPosition(slot),
        durationMs,
      }),
    fadeInAtXY: (id: string, x: number, y: number, durationMs: number) =>
      recorder.scene({
        kind: "prop.fadeIn",
        id,
        position: toVectorPosition(x, y),
        durationMs,
      }),
    fadeOut: (id: string, durationMs: number) =>
      recorder.scene({ kind: "prop.fadeOut", id, durationMs }),
    slideIn: (id: string, slot: string, direction: string, durationMs: number) =>
      recorder.scene({
        kind: "prop.slideIn",
        id,
        position: toSlotPosition(slot),
        direction: toDirection(direction),
        durationMs,
      }),
    slideInXY: (id: string, x: number, y: number, direction: string, durationMs: number) =>
      recorder.scene({
        kind: "prop.slideIn",
        id,
        position: toVectorPosition(x, y),
        direction: toDirection(direction),
        durationMs,
      }),
    slideOut: (id: string, direction: string, durationMs: number) =>
      recorder.scene({
        kind: "prop.slideOut",
        id,
        direction: toDirection(direction),
        durationMs,
      }),
    move: (id: string, slot: string, durationMs: number) =>
      recorder.scene({ kind: "prop.move", id, position: toSlotPosition(slot), durationMs }),
    moveXY: (id: string, x: number, y: number, durationMs: number) =>
      recorder.scene({ kind: "prop.move", id, position: toVectorPosition(x, y), durationMs }),
    setPosition: (id: string, slot: string) =>
      recorder.scene({ kind: "prop.setPosition", id, position: toSlotPosition(slot) }),
    setPositionXY: (id: string, x: number, y: number) =>
      recorder.scene({ kind: "prop.setPosition", id, position: toVectorPosition(x, y) }),
    setZ: (id: string, z: number) => recorder.scene({ kind: "prop.setZ", id, z }),
    setVariation: (id: string, variationId: string) =>
      recorder.scene({ kind: "prop.setVariation", id, variationId }),
    highlight: (id: string) => recorder.scene({ kind: "prop.highlight", id }),
    unhighlight: (id: string) => recorder.scene({ kind: "prop.unhighlight", id }),
  };

  return {
    ...api,
    Add: api.add,
    AddVariant: api.addVariant,
    Remove: api.remove,
    Show: api.show,
    ShowAt: api.showAt,
    ShowAtXY: api.showAtXY,
    Hide: api.hide,
    FadeIn: api.fadeIn,
    FadeInAt: api.fadeInAt,
    FadeInAtXY: api.fadeInAtXY,
    FadeOut: api.fadeOut,
    SlideIn: api.slideIn,
    SlideInXY: api.slideInXY,
    SlideOut: api.slideOut,
    Move: api.move,
    MoveXY: api.moveXY,
    SetPosition: api.setPosition,
    SetPositionXY: api.setPositionXY,
    SetZ: api.setZ,
    SetVariation: api.setVariation,
    Highlight: api.highlight,
    Unhighlight: api.unhighlight,
  };
}
