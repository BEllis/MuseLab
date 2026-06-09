import { describe, expect, it } from "vitest";
import { DEFAULT_BACKDROP_ID } from "../assets/defaultBackdrop";
import { expressionBlobKey } from "../assets/actorExpressions";
import { parseProject } from "./project";
import { migrateProjectBundle } from "./projectBundle";
import { isUuid } from "./id";
import {
  getEdgeOptionTextForLocale,
  getNodeTextTemplateForLocale,
} from "../locale/prompts";

describe("migrateProjectIdsToUuid", () => {
  it("migrates legacy string ids to UUIDs while preserving prompts and references", () => {
    const raw = JSON.stringify({
      name: "Legacy",
      assets: [
        {
          id: "hero1",
          type: "actor",
          name: "Hero",
          expressions: [{ id: "expr1", name: "default", url: "data:image/png;base64,abc" }],
        },
      ],
      stories: [
        {
          id: "main",
          name: "Main",
          nodes: [
            {
              id: "scene1",
              type: "scene",
              position: { x: 0, y: 0 },
              backdropId: DEFAULT_BACKDROP_ID,
              actorConfigs: [{ assetId: "hero1", expressionId: "expr1" }],
              soundConfigs: [],
              textTemplate: "<p>Hello</p>",
            },
          ],
          edges: [
            {
              id: "edge1",
              sourceNodeId: "scene1",
              targetNodeId: "scene1",
              optionText: "Continue",
            },
          ],
          globalState: {},
        },
      ],
      locales: ["en"],
    });

    const bundle = migrateProjectBundle(parseProject(raw));
    const story = bundle.project.stories[0]!;
    const scene = story.nodes[0]!;
    const edge = story.edges[0]!;
    const hero = bundle.project.assets.find((asset) => asset.type === "actor")!;
    const expression = hero.expressions![0]!;

    expect(isUuid(story.id)).toBe(true);
    expect(isUuid(scene.id)).toBe(true);
    expect(isUuid(edge.id)).toBe(true);
    expect(isUuid(hero.id)).toBe(true);
    expect(isUuid(expression.id)).toBe(true);
    expect(edge.sourceNodeId).toBe(scene.id);
    expect(edge.targetNodeId).toBe(scene.id);
    expect(scene.actorConfigs![0]).toEqual({
      assetId: hero.id,
      expressionId: expression.id,
    });
    expect(
      getNodeTextTemplateForLocale(bundle.promptsByLocale, "en", story.id, scene.id)
    ).toBe("<p>Hello</p>");
    expect(getEdgeOptionTextForLocale(bundle.promptsByLocale, "en", story.id, edge.id)).toBe(
      "Continue"
    );

    expect(bundle.blobKeyRemappings).toEqual(
      expect.arrayContaining([
        { from: "hero1", to: hero.id },
        {
          from: expressionBlobKey("hero1", "expr1"),
          to: expressionBlobKey(hero.id, expression.id),
        },
      ])
    );
  });

  it("leaves reserved built-in ids unchanged", () => {
    const bundle = migrateProjectBundle(parseProject(JSON.stringify({
      name: "Builtin",
      assets: [],
      stories: [
        {
          id: "a1000000-0000-4000-8000-000000000001",
          name: "Main",
          nodes: [
            {
              id: "a1000000-0000-4000-8000-000000000002",
              type: "scene",
              position: { x: 0, y: 0 },
              backdropId: DEFAULT_BACKDROP_ID,
              actorConfigs: [],
              soundConfigs: [],
            },
          ],
          edges: [],
          globalState: {},
        },
      ],
      locales: ["en"],
    })));

    const backdrop = bundle.project.assets.find((asset) => asset.id === DEFAULT_BACKDROP_ID);
    expect(backdrop).toBeDefined();
    expect(bundle.blobKeyRemappings).toEqual([]);
  });
});
