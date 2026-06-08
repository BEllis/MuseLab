import { describe, expect, it } from "vitest";
import {
  assertValidLocaleTag,
  isValidLocaleTag,
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

  it("normalizes locales and deduplicates", () => {
    expect(normalizeLocales(undefined)).toEqual(["en"]);
    expect(normalizeLocales(["EN", "de", "de"])).toEqual(["en", "de"]);
  });

  it("assertValidLocaleTag throws for invalid input", () => {
    expect(() => assertValidLocaleTag("-bad")).toThrow(/Invalid locale tag/);
  });

  it("parses prompts filenames", () => {
    expect(parseLocaleFromPromptsFileName("prompts.en.json")).toBe("en");
    expect(parseLocaleFromPromptsFileName("prompts.pt-br.json")).toBe("pt-br");
    expect(parseLocaleFromPromptsFileName("project.json")).toBeNull();
  });
});
