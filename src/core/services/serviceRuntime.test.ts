import { describe, expect, it } from "vitest";
import { createEmptyProject, addService } from "../model/project";
import { createNullStubService, createCustomServiceInstance } from "./serviceRuntime";

describe("serviceRuntime", () => {
  it("creates null stubs with default return values", () => {
    const project = createEmptyProject();
    const service = addService(project, "ITest");
    service.methods = [
      { name: "Noop", parameters: [], returnType: "void" },
      { name: "GetName", parameters: [], returnType: "string" },
      { name: "GetCount", parameters: [], returnType: "int" },
      { name: "IsReady", parameters: [], returnType: "bool" },
    ];

    const stub = createNullStubService(service);
    expect(stub.noop()).toBeUndefined();
    expect(stub.getName()).toBe("");
    expect(stub.getCount()).toBe(0);
    expect(stub.isReady()).toBe(false);
  });

  it("loads a TypeScript object implementation", () => {
    const project = createEmptyProject();
    const service = addService(project, "ICounter");
    service.methods = [
      { name: "Increment", parameters: [], returnType: "int" },
    ];
    service.typescriptSource = `
      let value = 0;
      const Counter = {
        Increment() { return ++value; }
      };
    `;

    const instance = createCustomServiceInstance(service);
    expect(instance.Increment()).toBe(1);
    expect(instance.Increment()).toBe(2);
  });
});
