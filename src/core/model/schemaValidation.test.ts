import { describe, expect, it } from "vitest";
import {
  validateBundlePayload,
  validateLocalePrompts,
  validateMlvnMetadata,
  validateStoryManifest,
} from "./schemaValidation";
import { MUSELAB_FORMAT_VERSION } from "./formatVersion";

const STORY_ID = "a1000000-0000-4000-8000-000000000001";
const SCENE_ID = "a1000000-0000-4000-8000-000000000002";
const EDGE_ID = "a1000000-0000-4000-8000-000000000003";
const SERVICE_ID = "a1000000-0000-4000-8000-000000000004";
const BACKDROP_ID = "a1000000-0000-4000-8000-000000000005";
const LOCALE_EN = {
  id: "a1000000-0000-4000-8000-000000000006",
  locale: "en",
  displayName: "English",
};

describe("MuseLab JSON schemas", () => {
  it("validates a versioned story manifest", () => {
    const result = validateStoryManifest({
      $schema: "https://muselab.dev/schemas/story.schema.json",
      formatVersion: MUSELAB_FORMAT_VERSION,
      name: "Untitled",
      assets: [
        {
          id: "muselab-default-backdrop",
          type: "backdrop",
          name: "default",
          url: "data:image/png;base64,...",
        },
      ],
      stories: [
        {
          id: STORY_ID,
          name: "Main",
          nodes: [
            {
              id: SCENE_ID,
              type: "scene",
              position: { x: 100, y: 100 },
              label: "Opening",
              backdropId: "muselab-default-backdrop",
              actorConfigs: [],
              soundConfigs: [],
            },
          ],
          edges: [],
          globalState: {},
        },
      ],
      locales: [LOCALE_EN],
      modules: [],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("validates project modules", () => {
    const result = validateStoryManifest({
      name: "Modules",
      assets: [
        {
          id: "muselab-default-backdrop",
          type: "backdrop",
          name: "default",
          url: "data:image/png;base64,...",
        },
      ],
      stories: [
        {
          id: STORY_ID,
          name: "Main",
          nodes: [],
          edges: [],
          globalState: {},
        },
      ],
      locales: [LOCALE_EN],
      modules: [
        {
          id: SERVICE_ID,
          name: "IGameSave",
          bindingName: "gameSave",
          methods: [
            {
              name: "Save",
              parameters: [{ name: "slotId", type: "int" }],
              returnType: "void",
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
  });

  it("validates assets with web blob storage flags", () => {
    const result = validateStoryManifest({
      name: "Web",
      assets: [
        {
          id: BACKDROP_ID,
          type: "backdrop",
          name: "City",
          blobStored: true,
        },
      ],
      stories: [
        {
          id: STORY_ID,
          name: "Main",
          nodes: [],
          edges: [],
          globalState: {},
        },
      ],
      locales: [LOCALE_EN],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.filter((warning) => warning.includes("additional properties"))).toEqual(
      []
    );
  });

  it("validates a versioned bundle payload", () => {
    const result = validateBundlePayload({
      formatVersion: MUSELAB_FORMAT_VERSION,
      schema: "https://muselab.dev/schemas/bundle.schema.json",
      project: {
        $schema: "https://muselab.dev/schemas/story.schema.json",
        formatVersion: MUSELAB_FORMAT_VERSION,
        name: "Untitled",
        assets: [
          {
            id: "muselab-default-backdrop",
            type: "backdrop",
            name: "default",
            url: "data:image/png;base64,...",
          },
        ],
        stories: [
          {
            id: STORY_ID,
            name: "Main",
            nodes: [
              {
                id: SCENE_ID,
                type: "scene",
                position: { x: 100, y: 100 },
                label: "Opening",
                backdropId: "muselab-default-backdrop",
                actorConfigs: [],
                soundConfigs: [],
              },
            ],
            edges: [],
            globalState: {},
          },
        ],
        locales: [LOCALE_EN],
      },
      promptsByLocale: {
        en: {
          $schema: "https://muselab.dev/schemas/prompts.schema.json",
          formatVersion: MUSELAB_FORMAT_VERSION,
          stories: {
            [STORY_ID]: {
              nodes: {
                [SCENE_ID]: {
                  textTemplate: "<p>The rain hasn't stopped for three days.</p>",
                  speaker: "Narrator",
                },
              },
              edges: {},
            },
          },
        },
      },
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("validates bundle session with selectedStoryId", () => {
    const result = validateBundlePayload({
      project: {
        name: "Untitled",
        assets: [],
        stories: [
          {
            id: STORY_ID,
            name: "Main",
            nodes: [],
            edges: [],
            globalState: {},
          },
        ],
        locales: [LOCALE_EN],
      },
      promptsByLocale: {
        en: { stories: {} },
      },
      session: {
        activeStoryId: STORY_ID,
        selectedStoryId: STORY_ID,
        eventLog: { events: [], cursor: -1 },
      },
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.filter((warning) => warning.includes("additional properties"))).toEqual(
      []
    );
  });

  it("warns about missing formatVersion but still validates legacy-shaped data", () => {
    const result = validateStoryManifest({
      name: "Legacy",
      assets: [],
      locales: [LOCALE_EN],
      stories: [
        {
          id: STORY_ID,
          name: "Main",
          nodes: [],
          edges: [],
          globalState: {},
        },
      ],
      nodes: [],
      edges: [],
      globalState: {},
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      "Missing formatVersion; treating this as a legacy project file."
    );
  });

  it("validates nested locale prompts with speaker", () => {
    const result = validateLocalePrompts({
      stories: {
        [STORY_ID]: {
          nodes: {
            [SCENE_ID]: {
              textTemplate: "<p>Hello</p>",
              speaker: "Maya",
            },
          },
          edges: {
            [EDGE_ID]: {
              optionText: "Continue",
            },
          },
        },
      },
    });

    expect(result.valid).toBe(true);
  });

  it("rejects legacy flat prompts without stories wrapper", () => {
    const result = validateLocalePrompts({
      nodes: {
        [SCENE_ID]: { textTemplate: "<p>Legacy</p>" },
      },
      edges: {},
    });

    expect(result.valid).toBe(false);
  });

  it("validates mlvn archive metadata", () => {
    const result = validateMlvnMetadata({
      formatVersion: MUSELAB_FORMAT_VERSION,
      schema: "https://muselab.dev/schemas/mlvn.schema.json",
      manifest: "project.json",
      promptsPattern: "prompts.{locale}.json",
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("rejects non-uuid object ids in versioned manifests", () => {
    const result = validateStoryManifest({
      formatVersion: MUSELAB_FORMAT_VERSION,
      name: "Invalid",
      assets: [],
      stories: [
        {
          id: "main",
          name: "Main",
          nodes: [],
          edges: [],
          globalState: {},
        },
      ],
      locales: [LOCALE_EN],
    });

    expect(result.valid).toBe(false);
  });

  it("validates nested attributes on project entities", () => {
    const result = validateStoryManifest({
      formatVersion: MUSELAB_FORMAT_VERSION,
      name: "Attributes",
      attributes: {
        exportTarget: { type: "string", value: "unity" },
      },
      assets: [
        {
          id: "muselab-default-backdrop",
          type: "backdrop",
          name: "default",
          url: "data:image/png;base64,...",
          attributes: {
            tint: { type: "string", value: "#ffffff" },
          },
        },
      ],
      stories: [
        {
          id: STORY_ID,
          name: "Main",
          attributes: {
            chapter: { type: "integer", value: 1 },
          },
          nodes: [
            {
              id: SCENE_ID,
              type: "scene",
              position: { x: 0, y: 0 },
              attributes: {
                border: {
                  type: "object",
                  value: {
                    width: { type: "integer", value: 2 },
                  },
                },
              },
              actorConfigs: [
                {
                  assetId: BACKDROP_ID,
                  expressionId: SCENE_ID,
                  attributes: {
                    x: { type: "number", value: 12.5 },
                  },
                },
              ],
              soundConfigs: [
                {
                  assetId: BACKDROP_ID,
                  attributes: {
                    fade: { type: "number", value: 0.5 },
                  },
                },
              ],
            },
          ],
          edges: [
            {
              id: EDGE_ID,
              sourceNodeId: SCENE_ID,
              targetNodeId: SCENE_ID,
              attributes: {
                style: { type: "string", value: "dashed" },
              },
            },
          ],
          globalState: {},
        },
      ],
      locales: [LOCALE_EN],
      modules: [],
    });

    expect(result.valid).toBe(true);
  });

  it("rejects invalid attribute value types", () => {
    const result = validateStoryManifest({
      name: "Invalid attributes",
      attributes: {
        bad: { type: "integer", value: 1.5 },
      },
      assets: [],
      stories: [
        {
          id: STORY_ID,
          name: "Main",
          nodes: [],
          edges: [],
          globalState: {},
        },
      ],
      locales: [LOCALE_EN],
    });

    expect(result.valid).toBe(false);
  });
});
