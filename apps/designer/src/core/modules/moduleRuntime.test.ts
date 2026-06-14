import { describe, expect, it } from "vitest";
import { createEmptyProject, addModule } from "../model/project";
import { createNullStubModule, createCustomModuleInstance } from "./moduleRuntime";

describe("moduleRuntime", () => {
  it("creates null stubs with default return values", () => {
    const project = createEmptyProject();
    const service = addModule(project, "ITest");
    service.methods = [
      { name: "Noop", parameters: [], returnType: "void" },
      { name: "GetName", parameters: [], returnType: "string" },
      { name: "GetCount", parameters: [], returnType: "int" },
      { name: "IsReady", parameters: [], returnType: "bool" },
    ];

    const stub = createNullStubModule(service);
    expect(stub.noop()).toBeUndefined();
    expect(stub.getName()).toBe("");
    expect(stub.getCount()).toBe(0);
    expect(stub.isReady()).toBe(false);
  });

  it("loads a TypeScript object implementation", () => {
    const project = createEmptyProject();
    const service = addModule(project, "ICounter");
    service.methods = [
      { name: "Increment", parameters: [], returnType: "int" },
    ];
    service.typescriptSource = `
      let value = 0;
      const Counter = {
        Increment() { return ++value; }
      };
    `;

    const instance = createCustomModuleInstance(service);
    expect(instance.Increment()).toBe(1);
    expect(instance.Increment()).toBe(2);
  });
});
