import { describe, expect, it } from "vitest";
import { DEFAULT_BACKDROP_ID } from "../assets/defaultBackdrop";
import { expressionBlobKey } from "../assets/actorExpressions";
import { parseProject } from "./project";
import { migrateProjectBundle } from "./projectBundle";
import { isUuid } from "./id";
import {
  createEmptyPromptsByLocale,
  getEdgeOptionTextForLocale,
  getNodeActionsForLocale,
  setEdgeOptionText,
  setNodeActions,
} from "../locale/prompts";
import type { SceneAction } from "../scene/actions";

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
          nodes: [{ id: "scene1", type: "scene", position: { x: 0, y: 0 } }],
          edges: [
            {
              id: "edge1",
              sourceNodeId: "scene1",
              targetNodeId: "scene1",
            },
          ],
          globalState: {},
        },
      ],
      locales: ["en"],
    });

    const project = parseProject(raw);
    const promptsByLocale = createEmptyPromptsByLocale(["en"]);
    setNodeActions(promptsByLocale.en, "main", "scene1", [
      { kind: "prop.add", id: "hero", assetId: "hero1", variationId: "expr1" },
      { kind: "dialogue.revealText", channel: "main", text: "Hello", reveal: { mode: "instant" } },
    ]);
    setEdgeOptionText(promptsByLocale.en, "main", "edge1", "Continue");

    const bundle = migrateProjectBundle(project, promptsByLocale);
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

    const actions: SceneAction[] = getNodeActionsForLocale(
      bundle.promptsByLocale,
      "en",
      story.id,
      scene.id
    );
    expect(actions).toEqual([
      { kind: "prop.add", id: "hero", assetId: hero.id, variationId: expression.id },
      { kind: "dialogue.revealText", channel: "main", text: "Hello", reveal: { mode: "instant" } },
    ]);
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
    const project = parseProject(
      JSON.stringify({
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
              },
            ],
            edges: [],
            globalState: {},
          },
        ],
        locales: ["en"],
      })
    );

    const promptsByLocale = createEmptyPromptsByLocale(["en"]);
    setNodeActions(
      promptsByLocale.en,
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000002",
      [{ kind: "bg.show", assetId: DEFAULT_BACKDROP_ID }]
    );

    const bundle = migrateProjectBundle(project, promptsByLocale);

    const backdrop = bundle.project.assets.find((asset) => asset.id === DEFAULT_BACKDROP_ID);
    expect(backdrop).toBeDefined();
    expect(bundle.blobKeyRemappings).toEqual([]);
  });
});
