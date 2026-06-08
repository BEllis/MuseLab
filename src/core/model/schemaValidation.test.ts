import { describe, expect, it } from "vitest";
import {
  validateBundlePayload,
  validateLocalePrompts,
  validateMlvnMetadata,
  validateStoryManifest,
} from "./schemaValidation";
import { MUSELAB_FORMAT_VERSION } from "./formatVersion";

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
          id: "main",
          name: "Main",
          nodes: [
            {
              id: "scene1",
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
      locales: ["en"],
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
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
            id: "story-main",
            name: "Main",
            nodes: [
              {
                id: "scene-opening",
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
        locales: ["en"],
      },
      promptsByLocale: {
        en: {
          $schema: "https://muselab.dev/schemas/prompts.schema.json",
          formatVersion: MUSELAB_FORMAT_VERSION,
          stories: {
            "story-main": {
              nodes: {
                "scene-opening": {
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

  it("warns about missing formatVersion but still validates legacy-shaped data", () => {
    const result = validateStoryManifest({
      name: "Legacy",
      assets: [],
      locales: ["en"],
      stories: [
        {
          id: "main",
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
        "story-main": {
          nodes: {
            "scene-opening": {
              textTemplate: "<p>Hello</p>",
              speaker: "Maya",
            },
          },
          edges: {
            "edge-continue": {
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
        "scene-opening": { textTemplate: "<p>Legacy</p>" },
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
});
