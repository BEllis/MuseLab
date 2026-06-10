import type { CitoType, ModuleInterface, ModuleMethod } from "@/core/model/types";

export type BuiltInModuleId = "builtin:runtime" | "builtin:format" | "builtin:prompter";

export type BuiltInModuleDefinition = {
  id: BuiltInModuleId;
  name: string;
  bindingName: string;
  className: string;
  overridableTypescript: boolean;
  methods: ModuleMethod[];
};

const RUNTIME_METHODS: ModuleMethod[] = [
  { name: "GetString", parameters: [{ name: "key", type: "string" }], returnType: "string" },
  { name: "GetBool", parameters: [{ name: "key", type: "string" }], returnType: "bool" },
  { name: "GetInt", parameters: [{ name: "key", type: "string" }], returnType: "int" },
  { name: "SetString", parameters: [{ name: "key", type: "string" }, { name: "value", type: "string" }], returnType: "void" },
  { name: "SetBool", parameters: [{ name: "key", type: "string" }, { name: "value", type: "bool" }], returnType: "void" },
  { name: "SetInt", parameters: [{ name: "key", type: "string" }, { name: "value", type: "int" }], returnType: "void" },
  { name: "Emit", parameters: [{ name: "eventName", type: "string" }], returnType: "void" },
  { name: "Call", parameters: [{ name: "name", type: "string" }], returnType: "string" },
  { name: "PlaySound", parameters: [{ name: "assetId", type: "string" }], returnType: "void" },
  {
    name: "PlaySoundTrim",
    parameters: [
      { name: "assetId", type: "string" },
      { name: "startTime", type: "double" },
      { name: "endTime", type: "double" },
    ],
    returnType: "void",
  },
  {
    name: "PlaySoundClip",
    parameters: [
      { name: "assetId", type: "string" },
      { name: "delaySeconds", type: "double" },
      { name: "startTime", type: "double" },
      { name: "endTime", type: "double" },
    ],
    returnType: "void",
  },
  {
    name: "PlaySoundClipByPath",
    parameters: [
      { name: "groupPath", type: "string" },
      { name: "assetName", type: "string" },
      { name: "delaySeconds", type: "double" },
      { name: "startTime", type: "double" },
      { name: "endTime", type: "double" },
    ],
    returnType: "void",
  },
];

const FORMAT_METHODS: ModuleMethod[] = [
  { name: "BoldStart", parameters: [], returnType: "string" },
  { name: "BoldEnd", parameters: [], returnType: "string" },
  { name: "ItalicStart", parameters: [], returnType: "string" },
  { name: "ItalicEnd", parameters: [], returnType: "string" },
  { name: "ColorStart", parameters: [{ name: "colorHex", type: "string" }], returnType: "string" },
  { name: "ColorEnd", parameters: [], returnType: "string" },
  { name: "ShakeCharsStart", parameters: [], returnType: "string" },
  { name: "ShakeCharsEnd", parameters: [], returnType: "string" },
  { name: "ShakePhraseStart", parameters: [], returnType: "string" },
  { name: "ShakePhraseEnd", parameters: [], returnType: "string" },
  { name: "ShakeCharsText", parameters: [{ name: "text", type: "string" }], returnType: "string" },
  { name: "ShakePhraseText", parameters: [{ name: "text", type: "string" }], returnType: "string" },
];

const PROMPT_RENDERER_METHODS: ModuleMethod[] = [
  { name: "AddLiteral", parameters: [{ name: "text", type: "string" }], returnType: "void" },
  { name: "AppendResult", parameters: [{ name: "value", type: "string" }], returnType: "void" },
  { name: "ApplyFormat", parameters: [{ name: "marker", type: "string" }], returnType: "void" },
  { name: "Wait", parameters: [{ name: "milliseconds", type: "int" }], returnType: "void" },
  { name: "RevealCharsBegin", parameters: [{ name: "charsPerSecond", type: "double" }], returnType: "void" },
  { name: "RevealWordsBegin", parameters: [{ name: "wordsPerSecond", type: "double" }], returnType: "void" },
  { name: "RevealCharsOverTimeBegin", parameters: [{ name: "durationMs", type: "int" }], returnType: "void" },
  { name: "RevealWordsOverTimeBegin", parameters: [{ name: "durationMs", type: "int" }], returnType: "void" },
  { name: "RevealEnd", parameters: [], returnType: "void" },
  { name: "Render", parameters: [], returnType: "string" },
];

export const BUILT_IN_MODULES: BuiltInModuleDefinition[] = [
  {
    id: "builtin:runtime",
    name: "IMuseLabRuntime",
    bindingName: "rt",
    className: "MuseLabRuntime",
    overridableTypescript: false,
    methods: RUNTIME_METHODS,
  },
  {
    id: "builtin:format",
    name: "IMuseLabFormat",
    bindingName: "format",
    className: "MuseLabFormat",
    overridableTypescript: false,
    methods: FORMAT_METHODS,
  },
  {
    id: "builtin:prompter",
    name: "IMuseLabPromptRenderer",
    bindingName: "prompter",
    className: "MuseLabPromptRenderer",
    overridableTypescript: true,
    methods: PROMPT_RENDERER_METHODS,
  },
];

export function isBuiltInModuleId(id: string): id is BuiltInModuleId {
  return id === "builtin:runtime" || id === "builtin:format" || id === "builtin:prompter";
}

export function getBuiltInModule(id: BuiltInModuleId): BuiltInModuleDefinition {
  const service = BUILT_IN_MODULES.find((entry) => entry.id === id);
  if (!service) {
    throw new Error(`Unknown built-in module: ${id}`);
  }
  return service;
}

export function citoTypeToString(type: CitoType): string {
  switch (type) {
    case "void":
      return "void";
    case "string":
      return "string";
    case "bool":
      return "bool";
    case "int":
      return "int";
    case "double":
      return "double";
    default:
      return "string";
  }
}

/** Map author-facing Format.* calls to format binding for generated Cito. */
export function normalizeFormatExpression(expr: string): string {
  return expr.replace(/\bFormat\./g, "format.");
}

export function isFormatExpression(expr: string): boolean {
  return /^\s*Format\./.test(expr.trim());
}

export function toModuleInterfaceShape(service: BuiltInModuleDefinition): ModuleInterface {
  return {
    id: service.id,
    name: service.name,
    bindingName: service.bindingName,
    methods: service.methods,
  };
}
