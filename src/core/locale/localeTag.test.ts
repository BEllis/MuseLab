import { describe, expect, it } from "vitest";
import {
  assertValidLocaleTag,
  getDefaultLocaleTag,
  isValidLocaleTag,
  migrateProjectDefaultLocale,
  normalizeLocales,
  parseLocaleFromPromptsFileName,
} from "./localeTag";

describe("localeTag", () => {
  it("accepts valid locale tags", () => {
    expect(isValidLocaleTag("en")).toBe(true);
    expect(isValidLocaleTag("de")).toBe(true);
    expect(isValidLocaleTag("pt-br")).toBe(true);
    expect(isValidLocaleTag("zh-hans")).toBe(true);
  });

  it("rejects invalid locale tags", () => {
    expect(isValidLocaleTag("-en")).toBe(false);
    expect(isValidLocaleTag("en-")).toBe(false);
    expect(isValidLocaleTag("EN")).toBe(false);
    expect(isValidLocaleTag("en_us")).toBe(false);
    expect(isValidLocaleTag("")).toBe(false);
  });

  it("normalizes locales, deduplicates, and sorts alphabetically", () => {
    expect(normalizeLocales(undefined)).toEqual(["en"]);
    expect(normalizeLocales(["EN", "de", "de"])).toEqual(["de", "en"]);
    expect(normalizeLocales(["fr", "en", "de"])).toEqual(["de", "en", "fr"]);
  });

  it("assertValidLocaleTag throws for invalid input", () => {
    expect(() => assertValidLocaleTag("-bad")).toThrow(/Invalid locale tag/);
  });

  it("parses prompts filenames", () => {
    expect(parseLocaleFromPromptsFileName("prompts.en.json")).toBe("en");
    expect(parseLocaleFromPromptsFileName("prompts.pt-br.json")).toBe("pt-br");
    expect(parseLocaleFromPromptsFileName("project.json")).toBeNull();
  });

  it("uses explicit defaultLocale when set", () => {
    expect(getDefaultLocaleTag(["de", "en", "fr"], "fr")).toBe("fr");
    expect(getDefaultLocaleTag(["de", "en"], "en")).toBe("en");
  });

  it("migrates legacy default locale before alphabetical sort", () => {
    const project = { locales: ["de", "en", "fr"] };
    migrateProjectDefaultLocale(project);
    expect(project.locales).toEqual(["de", "en", "fr"]);
    expect(project.defaultLocale).toBe("de");
  });
});
