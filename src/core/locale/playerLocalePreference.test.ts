import { describe, expect, it } from "vitest";
import { resolvePlayerLocale } from "./playerLocalePreference";

describe("playerLocalePreference", () => {
  it("falls back to the first locale when stored value is invalid", () => {
    expect(
      resolvePlayerLocale({
        projectName: "Demo",
        locales: ["en", "de"],
        storedLocale: "fr",
      })
    ).toBe("en");
  });

  it("uses a valid stored locale", () => {
    expect(
      resolvePlayerLocale({
        projectName: "Demo",
        locales: ["en", "de"],
        storedLocale: "de",
      })
    ).toBe("de");
  });
});
