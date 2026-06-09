import { describe, expect, it } from "vitest";
import { createEmptyProject, addModule } from "../model/project";
import { generateModuleCiStub, buildCiPreamble } from "./generateModuleCi";

describe("generateModuleCi", () => {
  it("generates a class stub from a service interface", () => {
    const project = createEmptyProject();
    const service = addModule(project, "IGameSave");
    service.methods = [
      {
        name: "SaveSlot",
        parameters: [{ name: "slotId", type: "int" }],
        returnType: "void",
      },
      {
        name: "LoadSlot",
        parameters: [{ name: "slotId", type: "int" }],
        returnType: "string",
      },
    ];

    const stub = generateModuleCiStub(service);
    expect(stub).toContain("public class GameSave");
    expect(stub).toContain("public void SaveSlot(int slotId)");
    expect(stub).toContain('return "";');
  });

  it("includes built-in and custom stubs in preamble", () => {
    const project = createEmptyProject();
    addModule(project, "ICustom");

    const preamble = buildCiPreamble(project);
    expect(preamble).toContain("public class MuseLabRuntime");
    expect(preamble).toContain("public class MuseLabFormat");
    expect(preamble).toContain("public class MuseLabPromptRenderer");
    expect(preamble).toContain("public class Custom");
  });
});
