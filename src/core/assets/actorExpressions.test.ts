import { describe, expect, it } from "vitest";
import { normalizeLocales } from "../locale/localeTag";
import type { Asset, Project } from "../model/types";
import {
  createExpression,
  ensureActorExpressions,
  getDefaultExpressionId,
  getExpressionUsage,
  isExpressionNameUnique,
  resolveExpression,
} from "./actorExpressions";
import { updateAsset as updateAssetInProject } from "../model/project";

function actorAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "actor1",
    type: "actor",
    name: "Hero",
    ...overrides,
  };
}

describe("ensureActorExpressions", () => {
  it("migrates legacy top-level image to default expression", () => {
    const asset = actorAsset({ path: "/tmp/hero.png" });
    ensureActorExpressions(asset);
    expect(asset.path).toBeUndefined();
    expect(asset.expressions).toHaveLength(1);
    expect(asset.expressions![0].name).toBe("default");
    expect(asset.expressions![0].path).toBe("/tmp/hero.png");
  });

  it("creates placeholder default expression when no media exists", () => {
    const asset = actorAsset();
    ensureActorExpressions(asset);
    expect(asset.expressions).toHaveLength(1);
    expect(asset.expressions![0].url).toBeTruthy();
  });

  it("does not duplicate expressions when already migrated", () => {
    const asset = actorAsset({
      expressions: [createExpression("happy")],
      path: "/tmp/legacy.png",
    });
    ensureActorExpressions(asset);
    expect(asset.expressions).toHaveLength(1);
    expect(asset.expressions![0].name).toBe("happy");
    expect(asset.path).toBeUndefined();
  });
});

describe("getDefaultExpressionId", () => {
  it("prefers expression named default", () => {
    const asset = actorAsset({
      expressions: [
        createExpression("happy"),
        createExpression("default"),
      ],
    });
    expect(getDefaultExpressionId(asset)).toBe(asset.expressions![1].id);
  });

  it("prefers explicit defaultExpressionId over name", () => {
    const asset = actorAsset({
      expressions: [createExpression("happy"), createExpression("default")],
    });
    asset.defaultExpressionId = asset.expressions![0].id;
    expect(getDefaultExpressionId(asset)).toBe(asset.expressions![0].id);
  });

  it("can be set via updateAsset when previously unset", () => {
    const project: Project = {
      name: "Test",
      assets: [
        actorAsset({
          expressions: [createExpression("happy"), createExpression("default")],
        }),
      ],
      locales: normalizeLocales(["en"]),
      modules: [],
      stories: [],
    };
    const actor = project.assets[0]!;
    expect(getDefaultExpressionId(actor)).toBe(actor.expressions![1].id);

    updateAssetInProject(project, actor.id, { defaultExpressionId: actor.expressions![0].id });
    expect(actor.defaultExpressionId).toBe(actor.expressions![0].id);
    expect(getDefaultExpressionId(actor)).toBe(actor.expressions![0].id);
  });
});

describe("resolveExpression", () => {
  it("falls back to first expression when id is missing", () => {
    const asset = actorAsset({
      expressions: [createExpression("neutral"), createExpression("happy")],
    });
    expect(resolveExpression(asset, "missing").name).toBe("neutral");
  });
});

describe("isExpressionNameUnique", () => {
  it("is case-insensitive", () => {
    const asset = actorAsset({
      expressions: [createExpression("Happy")],
    });
    expect(isExpressionNameUnique(asset, "happy")).toBe(false);
    expect(isExpressionNameUnique(asset, "happy", asset.expressions![0].id)).toBe(true);
  });
});

describe("getExpressionUsage", () => {
  it("counts scene references", () => {
    const project: Project = {
      name: "Test",
      assets: [],
      locales: normalizeLocales(["en"]),
      modules: [],
      stories: [
        {
          id: "s1",
          name: "Main",
          nodes: [
            {
              id: "n1",
              type: "scene",
              position: { x: 0, y: 0 },
              actorConfigs: [{ assetId: "actor1", expressionId: "expr1" }],
            },
            {
              id: "n2",
              type: "scene",
              position: { x: 0, y: 0 },
              actorConfigs: [{ assetId: "actor1", expressionId: "expr1" }],
            },
          ],
          edges: [],
          globalState: {},
        },
      ],
    };
    expect(getExpressionUsage(project, "actor1", "expr1")).toBe(2);
    expect(getExpressionUsage(project, "actor1", "expr2")).toBe(0);
  });
});
