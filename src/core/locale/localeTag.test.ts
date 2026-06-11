import { describe, expect, it } from "vitest";
import {
  assertValidLocaleTag,
  createLocale,
  getDefaultLocaleTag,
  getLocaleTags,
  hasLocaleTag,
  isValidLocaleTag,
  migrateProjectDefaultLocale,
  normalizeLocales,
  normalizeLocaleTags,
  parseLocaleFromPromptsFileName,
  sanitizeLocaleCodeInput,
} from "./localeTag";

const EN_ID = "a1000000-0000-4000-8000-000000000001";
const DE_ID = "a1000000-0000-4000-8000-000000000002";

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
    expect(normalizeLocaleTags(undefined)).toEqual(["en"]);
    expect(normalizeLocaleTags(["EN", "de", "de"])).toEqual(["de", "en"]);
    expect(normalizeLocaleTags(["fr", "en", "de"])).toEqual(["de", "en", "fr"]);
  });

  it("migrates legacy string locales to locale objects", () => {
    const locales = normalizeLocales(["EN", "de"]);
    expect(locales).toHaveLength(2);
    expect(locales[0]).toEqual(
      expect.objectContaining({ locale: "de", displayName: "de" })
    );
    expect(locales[1]).toEqual(
      expect.objectContaining({ locale: "en", displayName: "en" })
    );
    expect(locales.every((entry) => entry.id.length > 0)).toBe(true);
  });

  it("preserves locale ids and display names when provided", () => {
    const locales = normalizeLocales([
      createLocale("en", "English (US)", EN_ID),
      createLocale("de", "Deutsch", DE_ID),
    ]);
    expect(getLocaleTags(locales)).toEqual(["de", "en"]);
    expect(findLocale(locales, "en")).toEqual({
      id: EN_ID,
      locale: "en",
      displayName: "English (US)",
    });
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
    const locales = normalizeLocales(["de", "en", "fr"]);
    expect(getDefaultLocaleTag(locales, "fr")).toBe("fr");
    expect(getDefaultLocaleTag(locales, "en")).toBe("en");
  });

  it("migrates legacy default locale before alphabetical sort", () => {
    const project: { locales: ReturnType<typeof normalizeLocales> | string[]; defaultLocale?: string } =
      { locales: ["de", "en", "fr"] };
    migrateProjectDefaultLocale(project);
    expect(getLocaleTags(normalizeLocales(project.locales))).toEqual(["de", "en", "fr"]);
    expect(project.defaultLocale).toBe("de");
  });

  it("defaults display name to the locale code when omitted", () => {
    expect(createLocale("de").displayName).toBe("de");
    expect(createLocale("en-gb", "English (UK)").displayName).toBe("English (UK)");
  });

  it("sanitizes locale code input", () => {
    expect(sanitizeLocaleCodeInput("DE")).toBe("de");
    expect(sanitizeLocaleCodeInput("en_gb")).toBe("engb");
    expect(sanitizeLocaleCodeInput("en-gb-extra")).toBe("en-gb");
    expect(sanitizeLocaleCodeInput("123ab-c")).toBe("ab-c");
  });

  it("checks locale tag membership", () => {
    const locales = normalizeLocales(["en", "de"]);
    expect(hasLocaleTag(locales, "en")).toBe(true);
    expect(hasLocaleTag(locales, "fr")).toBe(false);
  });
});

function findLocale(locales: ReturnType<typeof normalizeLocales>, tag: string) {
  return locales.find((entry) => entry.locale === tag);
}
