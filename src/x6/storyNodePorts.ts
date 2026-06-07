const portMarkup = [{ tagName: "circle", selector: "circle" }];

const inPortAttrs = {
  r: 5,
  magnet: "passive",
  stroke: "#4a90d9",
  strokeWidth: 2,
  fill: "#fff",
};

const outPortAttrs = {
  r: 5,
  magnet: true,
  stroke: "#4a90d9",
  strokeWidth: 2,
  fill: "#fff",
  cursor: "crosshair",
};

export const storyNodePortGroups = {
  out: {
    position: { name: "right" as const },
    markup: portMarkup,
    attrs: {
      circle: outPortAttrs,
    },
  },
  in: {
    position: { name: "left" as const },
    markup: portMarkup,
    attrs: {
      circle: inPortAttrs,
    },
  },
};
