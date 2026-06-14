import { describe, expect, it } from "vitest";
import {
  createStarterProject,
  addAsset,
  addAssetGroup,
  removeAssetGroup,
  addActorExpression,
} from "@/core/model/project";
import {
  buildAssetTreeForType,
  getAssetTreeSiblings,
  placeAssetTreeItem,
} from "@/core/model/assetTree";

describe("assetTree", () => {
  it("builds grouped backdrop tree with default backdrop excluded", () => {
    const project = createStarterProject();
    const group = addAssetGroup(project, "backdrop", "Group A");
    addAsset(project, "backdrop", "Backdrop 1", {});
    addAsset(project, "backdrop", "Backdrop 2", {});

    const backdrop = project.assets.find((asset) => asset.type === "backdrop" && asset.name === "Backdrop 1");
    if (!backdrop) throw new Error("missing backdrop");
    backdrop.groupId = group.id;

    const tree = buildAssetTreeForType(project, "backdrop");
    expect(tree.some((node) => node.kind === "group" && node.name === "Group A")).toBe(true);
    const siblings = getAssetTreeSiblings(project, "backdrop", undefined);
    expect(siblings.some((entry) => entry.kind === "asset" && entry.id === "muselab-default-backdrop")).toBe(
      false
    );
  });

  it("moves assets between groups and reorders", () => {
    const project = createStarterProject();
    const groupA = addAssetGroup(project, "sound", "Group A");
    const groupB = addAssetGroup(project, "sound", "Group B");
    const sound = addAsset(project, "sound", "Clip", {});

    placeAssetTreeItem(project, { kind: "asset", id: sound.id }, {
      assetType: "sound",
      parentGroupId: groupA.id,
      index: 0,
    });
    expect(project.assets.find((asset) => asset.id === sound.id)?.groupId).toBe(groupA.id);

    placeAssetTreeItem(project, { kind: "asset", id: sound.id }, {
      assetType: "sound",
      parentGroupId: groupB.id,
      index: 0,
    });
    expect(project.assets.find((asset) => asset.id === sound.id)?.groupId).toBe(groupB.id);
  });

  it("removes nested groups and promotes assets", () => {
    const project = createStarterProject();
    const groupA = addAssetGroup(project, "actor", "Group A");
    const nested = addAssetGroup(project, "actor", "Nested", groupA.id);
    const actor = addAsset(project, "actor", "Alice", {});
    actor.groupId = nested.id;

    removeAssetGroup(project, nested.id);
    expect(project.assetGroups?.some((group) => group.id === nested.id)).toBe(false);
    expect(actor.groupId).toBe(groupA.id);
  });

  it("orders actor expressions and marks default", () => {
    const project = createStarterProject();
    const actor = addAsset(project, "actor", "Alice", {});
    addActorExpression(project, actor.id, "Happy");
    const sad = addActorExpression(project, actor.id, "Sad");

    placeAssetTreeItem(
      project,
      { kind: "expression", actorId: actor.id, id: sad.id },
      { assetType: "actor", parentActorId: actor.id, index: 0 }
    );

    const tree = buildAssetTreeForType(project, "actor");
    const alice = tree.find((node) => node.kind === "asset" && node.name === "Alice");
    expect(alice?.kind).toBe("asset");
    if (alice?.kind !== "asset") return;
    expect(alice.expressions[0]?.id).toBe(sad.id);
    expect(alice.expressions.some((entry) => entry.isDefault)).toBe(true);
  });
});
