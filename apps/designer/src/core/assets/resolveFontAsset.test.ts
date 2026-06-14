import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/core/model/project";
import { resolveFontAssetId } from "./resolveFontAsset";

describe("resolveFontAsset", () => {
  it("resolves a font asset by folder path and name", () => {
    const project = createEmptyProject();
    project.assetGroups = [{ id: "grp-ui", name: "UI", assetType: "font" }];
    project.assets = [
      ...project.assets,
      { id: "font-1", type: "font", name: "Title", groupId: "grp-ui" },
    ];

    expect(resolveFontAssetId(project, "UI", "Title")).toBe("font-1");
  });

  it("fails fast when the font is missing", () => {
    const project = createEmptyProject();
    project.assetGroups = [{ id: "grp-ui", name: "UI", assetType: "font" }];
    expect(() => resolveFontAssetId(project, "UI", "Missing")).toThrow(/Font not found/);
  });
});
