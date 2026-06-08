import type { Node } from "@antv/x6";
import type { StoryNodeType } from "@/core/model/types";
import {
  END_NODE_SHAPE,
  JUMP_NODE_SHAPE,
  START_NODE_SHAPE,
  STORY_NODE_SHAPE,
} from "./constants";

/** Right-pointing block arrow: flat back, shaft, triangular tip (100×52 ref box). */
export const ARROW_PATH_REF_D = "M 0 0 L 68 0 L 100 26 L 68 52 L 0 52 Z";

export const ARROW_NODE_WIDTH = 104;
export const ARROW_NODE_HEIGHT = 52;
/** Shaft width as a fraction of total node width (matches refD geometry). */
const ARROW_SHAFT_WIDTH_RATIO = 68 / 100;
const ARROW_LABEL_FONT_SIZE = 11;
const ARROW_LABEL_FONT_WEIGHT = 700;
const ARROW_SHAFT_PADDING = 20;
export const CIRCLE_NODE_SIZE = 52;

const INVALID_STROKE = "#dc2626";

const START_PALETTE = {
  fill: "#31d0c6",
  stroke: "#237804",
};

const JUMP_PALETTE = {
  fill: "#9254de",
  stroke: "#531dab",
};

const END_PALETTE = {
  fill: "#000000",
  stroke: "#ffffff",
};

export function shapeForStoryNodeType(type: StoryNodeType): string {
  switch (type) {
    case "start":
      return START_NODE_SHAPE;
    case "jump":
      return JUMP_NODE_SHAPE;
    default:
      return STORY_NODE_SHAPE;
  }
}

export function isPathNodeShape(shape: string): boolean {
  return shape === START_NODE_SHAPE || shape === JUMP_NODE_SHAPE;
}

export function isEndCircleShape(shape: string): boolean {
  return shape === END_NODE_SHAPE;
}

export function isNativeNonSceneShape(shape: string): boolean {
  return isPathNodeShape(shape) || isEndCircleShape(shape);
}

export function nodeDimensionsForShape(
  shape: string,
  label?: string
): { width: number; height: number } | null {
  if (isPathNodeShape(shape)) {
    return arrowNodeSizeForLabel(label ?? "Start");
  }
  if (isEndCircleShape(shape)) {
    return { width: CIRCLE_NODE_SIZE, height: CIRCLE_NODE_SIZE };
  }
  return null;
}

let measureContext: CanvasRenderingContext2D | null | undefined;

function measureArrowLabelWidth(label: string): number {
  if (typeof document !== "undefined") {
    if (measureContext === undefined) {
      const canvas = document.createElement("canvas");
      measureContext = canvas.getContext("2d");
    }
    if (measureContext) {
      measureContext.font = `${ARROW_LABEL_FONT_WEIGHT} ${ARROW_LABEL_FONT_SIZE}px Arial, helvetica, sans-serif`;
      return measureContext.measureText(label).width;
    }
  }
  return label.length * ARROW_LABEL_FONT_SIZE * 0.55;
}

export function arrowNodeSizeForLabel(label: string): {
  width: number;
  height: number;
} {
  const textWidth = measureArrowLabelWidth(label);
  const shaftWidth = textWidth + ARROW_SHAFT_PADDING * 2;
  const width = Math.max(
    ARROW_NODE_WIDTH,
    Math.ceil(shaftWidth / ARROW_SHAFT_WIDTH_RATIO)
  );
  return { width, height: ARROW_NODE_HEIGHT };
}

export function syncArrowNodeSize(node: Node, label: string): void {
  if (!isPathNodeShape(node.shape)) return;
  const { width, height } = arrowNodeSizeForLabel(label);
  const size = node.getSize();
  if (
    Math.abs(size.width - width) > 1 ||
    Math.abs(size.height - height) > 1
  ) {
    node.resize(width, height);
  }
}

const arrowLabelAttrs = {
  refX: 0.34,
  refY: 0.5,
  textAnchor: "middle" as const,
  textVerticalAnchor: "middle" as const,
  fontWeight: ARROW_LABEL_FONT_WEIGHT,
};

function applyArrowStyle(
  node: Node,
  label: string,
  palette: { fill: string; stroke: string },
  options: { selected: boolean; invalidRoot?: boolean }
): void {
  node.attr({
    body: {
      refD: ARROW_PATH_REF_D,
      fill: palette.fill,
      stroke: options.invalidRoot ? INVALID_STROKE : palette.stroke,
      strokeWidth: options.selected ? 3 : 2,
      strokeLinejoin: "round",
    },
    text: {
      text: label,
      fill: "#ffffff",
      fontSize: ARROW_LABEL_FONT_SIZE,
      ...arrowLabelAttrs,
    },
    label: {
      text: label,
      fill: "#ffffff",
      fontSize: ARROW_LABEL_FONT_SIZE,
      ...arrowLabelAttrs,
    },
  });
  node.setLabel(label);
}

export function applyStartArrowStyle(
  node: Node,
  label: string,
  options: { selected: boolean; invalidRoot: boolean }
): void {
  applyArrowStyle(node, label, START_PALETTE, options);
}

export function applyJumpArrowStyle(
  node: Node,
  label: string,
  options: { selected: boolean }
): void {
  applyArrowStyle(node, label, JUMP_PALETTE, { ...options, invalidRoot: false });
}

export function applyEndCircleStyle(node: Node): void {
  node.attr({
    body: {
      fill: END_PALETTE.fill,
      stroke: END_PALETTE.stroke,
      strokeWidth: 3,
    },
    text: {
      text: "End",
      fill: "#ffffff",
      fontSize: 11,
      fontWeight: 700,
    },
  });
}

export function applyNativeNodeStyle(
  node: Node,
  type: StoryNodeType,
  label: string,
  options: { selected: boolean; invalidRoot: boolean }
): void {
  if (type === "start") {
    applyStartArrowStyle(node, label, options);
    return;
  }
  if (type === "jump") {
    applyJumpArrowStyle(node, label, { selected: options.selected });
  }
}

export const SYNTHETIC_END_EDGE_STROKE = "#888888";
