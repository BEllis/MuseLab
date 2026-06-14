import { describe, expect, it } from "vitest";
import { createFormatRuntime } from "./formatRuntime";

describe("createFormatRuntime", () => {
  it("renders shake markup by default", () => {
    const format = createFormatRuntime();
    expect(format.shakeCharsText("hi")).toContain("muselab-shake-char");
    expect(format.shakePhraseStart()).toContain("muselab-shake-phrase");
  });

  it("renders plain text when disableShake is set", () => {
    const format = createFormatRuntime({ disableShake: true });
    expect(format.shakeCharsText("hi")).toBe("hi");
    expect(format.shakePhraseText("road")).toBe("road");
    expect(format.shakeCharsStart()).toBe("");
    expect(format.shakePhraseStart()).toBe("");
  });
});
