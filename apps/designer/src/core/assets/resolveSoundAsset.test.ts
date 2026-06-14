import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/core/model/project";
import { resolveSoundAssetId, resolveSoundAssetIdById } from "./resolveSoundAsset";

describe("resolveSoundAsset", () => {
  it("resolves a sound asset by folder path and name", () => {
    const project = createEmptyProject();
    project.assetGroups = [
      { id: "grp-sfx", name: "SFX", assetType: "sound" },
    ];
    project.assets = [
      { id: "sound-1", type: "sound", name: "Door", groupId: "grp-sfx" },
    ];

    expect(resolveSoundAssetId(project, "SFX", "Door")).toBe("sound-1");
  });

  it("fails fast when the sound clip is missing", () => {
    const project = createEmptyProject();
    project.assetGroups = [{ id: "grp-sfx", name: "SFX", assetType: "sound" }];
    expect(() => resolveSoundAssetId(project, "SFX", "Missing")).toThrow(
      /Sound clip not found/
    );
  });

  it("validates sound assets by id", () => {
    const project = createEmptyProject();
    project.assets = [{ id: "a1", type: "backdrop", name: "BG" }];
    expect(() => resolveSoundAssetIdById(project, "a1")).toThrow(/not a sound clip/);
  });
});
