import type { SceneAction } from "./actions";

/**
 * Runtime scene operations recorded while a compiled scene template executes.
 *
 * These mirror the authoring actions that change the stage, with positions and
 * durations already resolved to concrete values by the Cito bridges.
 */
export type SceneOp =
  | Extract<SceneAction, { kind: `bg.${string}` }>
  | Extract<SceneAction, { kind: `prop.${string}` }>
  | Extract<SceneAction, { kind: "dialogue.show" }>
  | Extract<SceneAction, { kind: "dialogue.hide" }>;

export function isSceneOpKind(kind: string): boolean {
  return (
    kind.startsWith("bg.") ||
    kind.startsWith("prop.") ||
    kind === "dialogue.show" ||
    kind === "dialogue.hide"
  );
}
