import type { CitoType, ModuleInterface, ModuleMethod } from "@/core/model/types";

export type BuiltInModuleId = "builtin:runtime" | "builtin:format" | "builtin:prompter";

export type BuiltInModuleDefinition = {
  id: BuiltInModuleId;
  name: string;
  description: string;
  bindingName: string;
  className: string;
  overridableTypescript: boolean;
  methods: ModuleMethod[];
};

const RUNTIME_METHODS: ModuleMethod[] = [
  {
    name: "GetString",
    parameters: [{ name: "key", type: "string" }],
    returnType: "string",
    description: "Read a string value from story runtime state.",
  },
  {
    name: "GetBool",
    parameters: [{ name: "key", type: "string" }],
    returnType: "bool",
    description: "Read a boolean value from story runtime state.",
  },
  {
    name: "GetInt",
    parameters: [{ name: "key", type: "string" }],
    returnType: "int",
    description: "Read an integer value from story runtime state.",
  },
  {
    name: "SetString",
    parameters: [
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    returnType: "void",
    description: "Write a string value into story runtime state.",
  },
  {
    name: "SetBool",
    parameters: [
      { name: "key", type: "string" },
      { name: "value", type: "bool" },
    ],
    returnType: "void",
    description: "Write a boolean value into story runtime state.",
  },
  {
    name: "SetInt",
    parameters: [
      { name: "key", type: "string" },
      { name: "value", type: "int" },
    ],
    returnType: "void",
    description: "Write an integer value into story runtime state.",
  },
  {
    name: "Emit",
    parameters: [{ name: "eventName", type: "string" }],
    returnType: "void",
    description: "Fire a named event to the player host (fire-and-forget side effect).",
  },
  {
    name: "Call",
    parameters: [{ name: "name", type: "string" }],
    returnType: "string",
    description: "Invoke a registered host handler by name and insert its string return value.",
  },
  {
    name: "PlaySound",
    parameters: [{ name: "assetId", type: "string" }],
    returnType: "void",
    description: "Play a sound asset immediately when the template is evaluated.",
  },
  {
    name: "PlaySoundTrim",
    parameters: [
      { name: "assetId", type: "string" },
      { name: "startTime", type: "double" },
      { name: "endTime", type: "double" },
    ],
    returnType: "void",
    description: "Play a trimmed segment of a sound asset immediately.",
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
    description:
      "Queue a sound clip at this point in the prompt stream. Use delaySeconds 0 to play when the player reaches this instruction; use startTime/endTime -1 for the full clip.",
  },
  {
    name: "WaitForContinue",
    parameters: [],
    returnType: "void",
    description:
      "Pause prompt playback and show a continue hint until the player clicks to proceed.",
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
    description:
      "Queue a sound clip resolved from an Assets folder path at this point in the prompt stream.",
  },
];

const FORMAT_METHODS: ModuleMethod[] = [
  {
    name: "BoldStart",
    parameters: [],
    returnType: "string",
    description: "Open a bold span; pair with BoldEnd around following text.",
  },
  {
    name: "BoldEnd",
    parameters: [],
    returnType: "string",
    description: "Close a bold span opened with BoldStart.",
  },
  {
    name: "ItalicStart",
    parameters: [],
    returnType: "string",
    description: "Open an italic span; pair with ItalicEnd around following text.",
  },
  {
    name: "ItalicEnd",
    parameters: [],
    returnType: "string",
    description: "Close an italic span opened with ItalicStart.",
  },
  {
    name: "ColorStart",
    parameters: [{ name: "colorHex", type: "string" }],
    returnType: "string",
    description: "Open a colored span using a CSS hex color (e.g. #ff0000).",
  },
  {
    name: "ColorEnd",
    parameters: [],
    returnType: "string",
    description: "Close a colored span opened with ColorStart.",
  },
  {
    name: "ShakeCharsStart",
    parameters: [],
    returnType: "string",
    description: "Start per-character shake on following text; pair with ShakeCharsEnd.",
  },
  {
    name: "ShakeCharsEnd",
    parameters: [],
    returnType: "string",
    description: "End per-character shake started with ShakeCharsStart.",
  },
  {
    name: "ShakePhraseStart",
    parameters: [],
    returnType: "string",
    description: "Start phrase-level shake on following text; pair with ShakePhraseEnd.",
  },
  {
    name: "ShakePhraseEnd",
    parameters: [],
    returnType: "string",
    description: "End phrase-level shake started with ShakePhraseStart.",
  },
  {
    name: "ShakeCharsText",
    parameters: [{ name: "text", type: "string" }],
    returnType: "string",
    description: "Insert text with per-character shake applied inline.",
  },
  {
    name: "ShakePhraseText",
    parameters: [{ name: "text", type: "string" }],
    returnType: "string",
    description: "Insert text with phrase-level shake applied inline.",
  },
];

const PROMPT_RENDERER_METHODS: ModuleMethod[] = [
  {
    name: "AddLiteral",
    parameters: [{ name: "text", type: "string" }],
    returnType: "void",
    description: "Append literal text to the rendered output (used internally by the template compiler).",
  },
  {
    name: "AppendResult",
    parameters: [{ name: "value", type: "string" }],
    returnType: "void",
    description: "Append an expression result to the rendered output (used internally by the template compiler).",
  },
  {
    name: "ApplyFormat",
    parameters: [{ name: "marker", type: "string" }],
    returnType: "void",
    description: "Apply a format marker to the output stream (used internally by the template compiler).",
  },
  {
    name: "WaitInMs",
    parameters: [{ name: "milliseconds", type: "int" }],
    returnType: "void",
    description: "Pause prompt playback for the given number of milliseconds before continuing.",
  },
  {
    name: "RevealCharsBegin",
    parameters: [{ name: "charsPerSecond", type: "double" }],
    returnType: "void",
    description:
      "Reveal following text character by character; use -1 for the default rate (40 characters per second).",
  },
  {
    name: "RevealWordsBegin",
    parameters: [{ name: "wordsPerSecond", type: "double" }],
    returnType: "void",
    description: "Reveal following text word by word; use -1 for the default rate (12 words per second).",
  },
  {
    name: "RevealCharsOverTimeBegin",
    parameters: [{ name: "durationMs", type: "int" }],
    returnType: "void",
    description:
      "Reveal the block from Begin to RevealEnd over durationMs milliseconds, character by character.",
  },
  {
    name: "RevealWordsOverTimeBegin",
    parameters: [{ name: "durationMs", type: "int" }],
    returnType: "void",
    description: "Reveal the block from Begin to RevealEnd over durationMs milliseconds, word by word.",
  },
  {
    name: "RevealEnd",
    parameters: [],
    returnType: "void",
    description: "End a reveal block; following text appears instantly.",
  },
  {
    name: "Render",
    parameters: [],
    returnType: "string",
    description: "Return the accumulated HTML output (used internally by the template compiler).",
  },
];

export const BUILT_IN_MODULES: BuiltInModuleDefinition[] = [
  {
    id: "builtin:runtime",
    name: "IMuseLabRuntime",
    description:
      "Story runtime bridge for reading and writing state, firing host events, calling handlers, and playing sounds.",
    bindingName: "rt",
    className: "MuseLabRuntime",
    overridableTypescript: false,
    methods: RUNTIME_METHODS,
  },
  {
    id: "builtin:format",
    name: "IMuseLabFormat",
    description: "HTML markup helpers for bold, italic, color, and shake effects in scene text.",
    bindingName: "format",
    className: "MuseLabFormat",
    overridableTypescript: false,
    methods: FORMAT_METHODS,
  },
  {
    id: "builtin:prompter",
    name: "IMuseLabPromptRenderer",
    description:
      "Sequential prompt renderer for timed dialogue playback (waits, reveals, and text assembly).",
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
    description: service.description,
    bindingName: service.bindingName,
    methods: service.methods,
  };
}
