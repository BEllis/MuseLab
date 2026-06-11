import { describe, expect, it } from "vitest";
import {
  countTemplateLiteralChars,
  getTemplateLiteralText,
  templateHasPlaySound,
} from "./templateStats";

describe("getTemplateLiteralText", () => {
  it("returns only literal text, excluding razor embeddings", () => {
    expect(getTemplateLiteralText('Hi @rt.GetString("name")!')).toBe("Hi !");
    expect(getTemplateLiteralText("@Format.BoldStart()hi@Format.BoldEnd()")).toBe("hi");
    expect(getTemplateLiteralText("@{ prompter.WaitInMs(500); }Hello")).toBe("Hello");
    expect(getTemplateLiteralText('@{ rt.PlaySoundClip("sfx", 0, -1, -1); }')).toBe("");
  });
});

describe("countTemplateLiteralChars", () => {
  it("counts only literal text, excluding razor embeddings", () => {
    expect(countTemplateLiteralChars('Hi @rt.GetString("name")!')).toBe(4);
    expect(countTemplateLiteralChars("@Format.BoldStart()hi@Format.BoldEnd()")).toBe(2);
    expect(countTemplateLiteralChars("@{ prompter.WaitInMs(500); }Hello")).toBe(5);
  });

  it("includes literals inside if blocks", () => {
    expect(countTemplateLiteralChars('@if (rt.GetBool("x")) { Yes }')).toBe(5);
  });

  it("returns zero for empty templates", () => {
    expect(countTemplateLiteralChars("")).toBe(0);
    expect(countTemplateLiteralChars('@{ rt.PlaySoundClip("sfx", 0, -1, -1); }')).toBe(0);
  });
});

describe("templateHasPlaySound", () => {
  it("detects PlaySound and PlaySoundClip", () => {
    expect(templateHasPlaySound('@{ rt.PlaySound("sfx"); }')).toBe(true);
    expect(templateHasPlaySound('@{ rt.PlaySoundClip("sfx", 0, -1, -1); }')).toBe(true);
    expect(templateHasPlaySound("Hello world")).toBe(false);
    expect(templateHasPlaySound('@{ rt.PlaySoundTrim("sfx", 0, 1); }')).toBe(false);
  });
});
