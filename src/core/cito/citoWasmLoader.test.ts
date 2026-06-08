import { describe, expect, it } from "vitest";
import { resolveWasmAssetUrl } from "./citoWasmLoader";

const LOCATION = "http://localhost:5173/";

describe("resolveWasmAssetUrl", () => {
  it("resolves framework assets under the cito-wasm base", () => {
    expect(resolveWasmAssetUrl("./cito-wasm/_framework/", "cito-wasm.wasm", LOCATION)).toBe(
      "http://localhost:5173/cito-wasm/_framework/cito-wasm.wasm"
    );
  });

  it("does not double-prefix when runtime passes cito-wasm/ paths", () => {
    expect(resolveWasmAssetUrl("./cito-wasm/_framework/", "cito-wasm/_framework/dotnet.js", LOCATION)).toBe(
      "http://localhost:5173/cito-wasm/_framework/dotnet.js"
    );
  });

  it("passes through absolute URLs", () => {
    const url = "https://example.com/foo.dll";
    expect(resolveWasmAssetUrl("./cito-wasm/", url, LOCATION)).toBe(url);
  });
});
