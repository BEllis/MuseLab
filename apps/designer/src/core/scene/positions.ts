/**
 * Logical stage space used by every scripted scene position.
 *
 * Coordinates are resolution independent: x runs 0 (left) to 16 (right),
 * y runs 0 (bottom) to 9 (top). Renderers map this box onto their own viewport.
 */
export const STAGE_WIDTH = 16;
export const STAGE_HEIGHT = 9;

export const POSITION_SLOTS = [
  "TopLeft",
  "Top",
  "TopRight",
  "FarLeft",
  "Left",
  "Centre",
  "Right",
  "FarRight",
  "BottomLeft",
  "Bottom",
  "BottomRight",
] as const;

export type PositionSlot = (typeof POSITION_SLOTS)[number];

export const DIRECTIONS = [
  "Left",
  "Right",
  "Top",
  "Bottom",
  "TopLeft",
  "TopRight",
  "BottomLeft",
  "BottomRight",
] as const;

export type Direction = (typeof DIRECTIONS)[number];

export type StageVector = { x: number; y: number };

/**
 * A position is either a named slot or explicit coordinates. The two stay
 * distinguishable end to end so slots can gain their own anchoring rules later.
 */
export type StagePosition =
  | { kind: "slot"; slot: PositionSlot }
  | { kind: "vec"; x: number; y: number };

const SLOT_VECTORS: Record<PositionSlot, StageVector> = {
  TopLeft: { x: 4, y: 7.5 },
  Top: { x: 8, y: 7.5 },
  TopRight: { x: 12, y: 7.5 },
  FarLeft: { x: 1.5, y: 4.5 },
  Left: { x: 4, y: 4.5 },
  Centre: { x: 8, y: 4.5 },
  Right: { x: 12, y: 4.5 },
  FarRight: { x: 14.5, y: 4.5 },
  BottomLeft: { x: 4, y: 1.5 },
  Bottom: { x: 8, y: 1.5 },
  BottomRight: { x: 12, y: 1.5 },
};

const DIRECTION_VECTORS: Record<Direction, StageVector> = {
  Left: { x: -1, y: 0 },
  Right: { x: 1, y: 0 },
  Top: { x: 0, y: 1 },
  Bottom: { x: 0, y: -1 },
  TopLeft: { x: -1, y: 1 },
  TopRight: { x: 1, y: 1 },
  BottomLeft: { x: -1, y: -1 },
  BottomRight: { x: 1, y: -1 },
};

export function isPositionSlot(value: string): value is PositionSlot {
  return (POSITION_SLOTS as readonly string[]).includes(value);
}

export function isDirection(value: string): value is Direction {
  return (DIRECTIONS as readonly string[]).includes(value);
}

export function slotPosition(slot: PositionSlot): StagePosition {
  return { kind: "slot", slot };
}

export function vectorPosition(x: number, y: number): StagePosition {
  return { kind: "vec", x, y };
}

/** Resolve any position to concrete stage coordinates. */
export function resolvePosition(position: StagePosition): StageVector {
  if (position.kind === "slot") {
    return { ...SLOT_VECTORS[position.slot] };
  }
  return { x: position.x, y: position.y };
}

export function directionVector(direction: Direction): StageVector {
  return { ...DIRECTION_VECTORS[direction] };
}

/**
 * Point just outside the stage in `direction`, keeping the axis that the
 * direction does not travel along aligned with `from`.
 */
export function offstagePosition(from: StageVector, direction: Direction): StageVector {
  const vector = directionVector(direction);
  const margin = 0.75;
  return {
    x: vector.x === 0 ? from.x : vector.x < 0 ? -STAGE_WIDTH * margin : STAGE_WIDTH * (1 + margin),
    y: vector.y === 0 ? from.y : vector.y < 0 ? -STAGE_HEIGHT * margin : STAGE_HEIGHT * (1 + margin),
  };
}

export function isVectorInBounds(x: number, y: number): boolean {
  return x >= 0 && x <= STAGE_WIDTH && y >= 0 && y <= STAGE_HEIGHT;
}

export function formatPosition(position: StagePosition): string {
  if (position.kind === "slot") return position.slot;
  return `(${position.x}, ${position.y})`;
}

/** Normalized 0..1 coordinates with y flipped for top-left based renderers. */
export function toNormalizedTopLeft(vector: StageVector): { left: number; top: number } {
  return {
    left: vector.x / STAGE_WIDTH,
    top: 1 - vector.y / STAGE_HEIGHT,
  };
}
