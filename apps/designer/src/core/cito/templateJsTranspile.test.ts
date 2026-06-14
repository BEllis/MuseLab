import { describe, expect, it } from "vitest";
import { compileTemplate } from "@/core/cito/compileTemplate";
import { createEmptyProject } from "@/core/model/project";
import { isCitoCliAvailable, transpileCiWithCli } from "@/test/citoTestHarness";

describe("debug template js transpile", () => {
  it("transpiles compiled template CI to js", async (ctx) => {
    if (!isCitoCliAvailable()) {
      ctx.skip();
    }

    const project = createEmptyProject();
    const { ciSource } = compileTemplate('<p>Hello @rt.GetString("name")!</p>', project);
    const js = await transpileCiWithCli(ciSource, "js");
    expect(js).toContain("render");
  }, 60_000);
});
