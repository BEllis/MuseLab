import { Graph } from "@antv/x6";
import { register } from "@antv/x6-react-shape";
import "@antv/x6-react-shape";
import { StoryNodeView } from "@/components/StoryNode";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from "@/utils/nodeOverlap";
import { STORY_EDGE_SHAPE, STORY_NODE_SHAPE } from "./constants";
import {
  autoEdgeRouter,
  storyEdgeConnector,
} from "./edgeConfig";
import { storyNodePortGroups } from "./storyNodePorts";

let registered = false;

export function ensureShapesRegistered(): void {
  if (registered) return;
  registered = true;

  register({
    shape: STORY_NODE_SHAPE,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
    effect: ["data"],
    component: StoryNodeView,
    ports: {
      groups: storyNodePortGroups,
    },
    attrs: {
      body: {
        magnet: false,
        fill: "transparent",
        stroke: "none",
      },
    },
  });

  Graph.registerEdge(
    STORY_EDGE_SHAPE,
    {
      inherit: "edge",
      router: autoEdgeRouter,
      connector: storyEdgeConnector,
      attrs: {
        line: {
          stroke: "#888",
          strokeWidth: 2,
          targetMarker: {
            name: "block",
            width: 10,
            height: 6,
          },
        },
      },
      defaultLabel: {
        markup: [
          { tagName: "rect", selector: "body" },
          { tagName: "text", selector: "label" },
        ],
        attrs: {
          label: {
            fill: "#333",
            fontSize: 11,
            textAnchor: "middle",
            textVerticalAnchor: "middle",
            pointerEvents: "none",
          },
          body: {
            ref: "label",
            fill: "#fff",
            stroke: "#ccc",
            strokeWidth: 1,
            rx: 4,
            ry: 4,
            refWidth: 1,
            refHeight: 1,
            refX: 0,
            refY: 0,
          },
        },
        position: { distance: 0.5 },
      },
    },
    true
  );
}
