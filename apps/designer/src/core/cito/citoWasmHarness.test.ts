import { afterAll, describe, expect, it } from "vitest";
import { probeCitoWasm, startCitoWasmStaticServer, stopCitoWasmStaticServer } from "@/test/citoTestHarness";

describe("cito wasm test harness", () => {
  afterAll(async () => {
    await stopCitoWasmStaticServer();
  });

  it("serves the cito-wasm boot manifest from a local static server", async () => {
    const baseUrl = await startCitoWasmStaticServer();
    const response = await fetch(new URL("cito-wasm/_framework/blazor.boot.json", baseUrl));
    expect(response.ok).toBe(true);
    expect(await probeCitoWasm()).toBe(true);
  });
});
