import { describe, expect, it } from "vitest";
import { scanCitoExpression } from "./museLabRazorScan";

function scanned(source: string, start = 0): string {
  const end = scanCitoExpression(source, start);
  return source.slice(start, end);
}

describe("scanCitoExpression", () => {
  it("stops before trailing comma or question mark", () => {
    expect(scanned('rt.GetString("name"), friend')).toBe('rt.GetString("name")');
    expect(scanned('rt.GetBool("x")?')).toBe('rt.GetBool("x")');
  });

  it("includes commas inside argument lists", () => {
    expect(scanned('rt.PlaySoundClip("sfx", 0, -1, -1)')).toBe(
      'rt.PlaySoundClip("sfx", 0, -1, -1)',
    );
  });
});
