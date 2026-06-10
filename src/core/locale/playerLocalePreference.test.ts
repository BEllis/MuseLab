import { describe, expect, it } from "vitest";
import { resolvePlayerLocale } from "./playerLocalePreference";

describe("playerLocalePreference", () => {
  it("falls back to the default locale when stored value is invalid", () => {
    expect(
      resolvePlayerLocale({
        projectName: "Demo",
        locales: ["en", "de"],
        defaultLocale: "en",
        storedLocale: "fr",
      })
    ).toBe("en");
  });

  it("uses a valid stored locale", () => {
    expect(
      resolvePlayerLocale({
        projectName: "Demo",
        locales: ["de", "en"],
        defaultLocale: "en",
        storedLocale: "de",
      })
    ).toBe("de");
  });
});
