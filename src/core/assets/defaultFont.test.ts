import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../model/project";
import {
  DEFAULT_FONT_ID,
  ensureDefaultFont,
  getDefaultFontId,
  resolveFontId,
} from "./defaultFont";

describe("defaultFont", () => {
  it("injects the built-in default font asset", () => {
    const project = createEmptyProject("Test");
    const font = project.assets.find((asset) => asset.id === DEFAULT_FONT_ID);
    expect(font?.type).toBe("font");
    expect(getDefaultFontId(project)).toBe(DEFAULT_FONT_ID);
  });

  it("resolves invalid font ids to the project default", () => {
    const project = createEmptyProject("Test");
    const customId = project.assets.find((asset) => asset.type === "font" && asset.id !== DEFAULT_FONT_ID);
    if (!customId) {
      project.assets.push({
        id: "custom-font-id",
        type: "font",
        name: "Custom",
      });
    }
    project.defaultFontId = "custom-font-id";
    ensureDefaultFont(project);
    expect(resolveFontId(project, "missing-font")).toBe("custom-font-id");
  });
});
