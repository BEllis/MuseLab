import type { CitoType, ModuleInterface, ModuleMethod } from "@/core/model/types";

export type BuiltInModuleId =
  | "builtin:runtime"
  | "builtin:format"
  | "builtin:prompter"
  | "builtin:background"
  | "builtin:prop";

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
    name: "HasKey",
    parameters: [{ name: "key", type: "string" }],
    returnType: "bool",
    description: "True when the runtime state contains this key.",
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
    name: "UnderlineStart",
    parameters: [],
    returnType: "string",
    description: "Open an underlined span; pair with UnderlineEnd around following text.",
  },
  {
    name: "UnderlineEnd",
    parameters: [],
    returnType: "string",
    description: "Close an underlined span opened with UnderlineStart.",
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
  {
    name: "FontStyleBegin",
    parameters: [
      { name: "fontAssetId", type: "string" },
      { name: "fontSizePx", type: "int" },
      { name: "fontWeight", type: "int" },
    ],
    returnType: "string",
    description:
      "Open a font-family span from a font asset id; optional initial size (px) and weight (100–900). Use -1 to omit.",
  },
  {
    name: "FontStyleByPathBegin",
    parameters: [
      { name: "groupPath", type: "string" },
      { name: "assetName", type: "string" },
      { name: "fontSizePx", type: "int" },
      { name: "fontWeight", type: "int" },
    ],
    returnType: "string",
    description:
      "Open a font-family span resolved from an Assets folder path and font name; optional size (px) and weight (100–900). Use -1 to omit.",
  },
  {
    name: "FontStyleEnd",
    parameters: [],
    returnType: "string",
    description:
      "Close a font-family span opened with FontStyleBegin or FontStyleByPathBegin; also closes any open FontSizeBegin/FontWeightBegin spans in the block.",
  },
  {
    name: "FontSizeBegin",
    parameters: [{ name: "fontSizePx", type: "int" }],
    returnType: "string",
    description: "Open a nested font-size span inside FontStyleBegin (1–200 px).",
  },
  {
    name: "FontSizeEnd",
    parameters: [],
    returnType: "string",
    description: "Close a font-size span opened with FontSizeBegin.",
  },
  {
    name: "FontWeightBegin",
    parameters: [{ name: "fontWeight", type: "int" }],
    returnType: "string",
    description: "Open a nested font-weight span inside FontStyleBegin (100–900, step 100).",
  },
  {
    name: "FontWeightEnd",
    parameters: [],
    returnType: "string",
    description: "Close a font-weight span opened with FontWeightBegin.",
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
    name: "WaitForContinue",
    parameters: [],
    returnType: "void",
    description:
      "Pause prompt playback and show a continue hint until the player clicks to proceed.",
  },
  {
    name: "SpeakerBegin",
    parameters: [],
    returnType: "void",
    description:
      "Start capturing following literal and format output as the speaker name instead of dialogue text.",
  },
  {
    name: "SpeakerEnd",
    parameters: [],
    returnType: "void",
    description: "Commit the captured speaker name and resume normal dialogue output.",
  },
  {
    name: "ShowDialogue",
    parameters: [{ name: "channel", type: "string" }],
    returnType: "void",
    description: "Show the dialogue box for a channel at this point in the prompt stream.",
  },
  {
    name: "HideDialogue",
    parameters: [{ name: "channel", type: "string" }],
    returnType: "void",
    description: "Hide the dialogue box for a channel at this point in the prompt stream.",
  },
  {
    name: "Reset",
    parameters: [],
    returnType: "void",
    description: "Clear all prompt text and reset the speaker before continuing template playback.",
  },
  {
    name: "Clear",
    parameters: [],
    returnType: "void",
    description: "Clear prompt text while keeping the current speaker before continuing template playback.",
  },
  {
    name: "Render",
    parameters: [],
    returnType: "string",
    description: "Return the accumulated HTML output (used internally by the template compiler).",
  },
  {
    name: "GetSpeakerHtml",
    parameters: [],
    returnType: "string",
    description: "Return the speaker HTML captured between SpeakerBegin and SpeakerEnd.",
  },
];

const BACKGROUND_METHODS: ModuleMethod[] = [
  {
    name: "Show",
    parameters: [{ name: "assetId", type: "string" }],
    returnType: "void",
    description: "Replace the background immediately and unload the previous one.",
  },
  {
    name: "Clear",
    parameters: [],
    returnType: "void",
    description: "Remove the current background and unload its asset.",
  },
  {
    name: "Fade",
    parameters: [
      { name: "assetId", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Cross-fade from the current background to a new one, then unload the old one.",
  },
  {
    name: "SlideIn",
    parameters: [
      { name: "assetId", type: "string" },
      { name: "direction", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Slide a new background in over the current one from the given direction.",
  },
  {
    name: "SlideOut",
    parameters: [
      { name: "direction", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Slide the current background off screen and unload it.",
  },
];

const PROP_METHODS: ModuleMethod[] = [
  {
    name: "Add",
    parameters: [
      { name: "id", type: "string" },
      { name: "assetId", type: "string" },
    ],
    returnType: "void",
    description: "Register a hidden scene object under an instance id and prepare its asset.",
  },
  {
    name: "AddVariant",
    parameters: [
      { name: "id", type: "string" },
      { name: "assetId", type: "string" },
      { name: "variationId", type: "string" },
    ],
    returnType: "void",
    description: "Register a hidden scene object using a specific variation or expression.",
  },
  {
    name: "Remove",
    parameters: [{ name: "id", type: "string" }],
    returnType: "void",
    description: "Destroy a scene object immediately and release its asset reference.",
  },
  {
    name: "Show",
    parameters: [{ name: "id", type: "string" }],
    returnType: "void",
    description: "Make a prop visible at its current position.",
  },
  {
    name: "ShowAt",
    parameters: [
      { name: "id", type: "string" },
      { name: "slot", type: "string" },
    ],
    returnType: "void",
    description: "Make a prop visible at a named position slot.",
  },
  {
    name: "ShowAtXY",
    parameters: [
      { name: "id", type: "string" },
      { name: "x", type: "double" },
      { name: "y", type: "double" },
    ],
    returnType: "void",
    description: "Make a prop visible at stage coordinates (x 0-16, y 0-9).",
  },
  {
    name: "Hide",
    parameters: [{ name: "id", type: "string" }],
    returnType: "void",
    description: "Hide a prop; it is unloaded at the next dialogue boundary if still hidden.",
  },
  {
    name: "FadeIn",
    parameters: [
      { name: "id", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Fade a prop from transparent to fully visible.",
  },
  {
    name: "FadeInAt",
    parameters: [
      { name: "id", type: "string" },
      { name: "slot", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Position a prop at a named slot, then fade it in.",
  },
  {
    name: "FadeInAtXY",
    parameters: [
      { name: "id", type: "string" },
      { name: "x", type: "double" },
      { name: "y", type: "double" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Position a prop at stage coordinates, then fade it in.",
  },
  {
    name: "FadeOut",
    parameters: [
      { name: "id", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Fade a prop to transparent and mark it hidden.",
  },
  {
    name: "SlideIn",
    parameters: [
      { name: "id", type: "string" },
      { name: "slot", type: "string" },
      { name: "direction", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Slide a prop in from off screen to a named slot.",
  },
  {
    name: "SlideInXY",
    parameters: [
      { name: "id", type: "string" },
      { name: "x", type: "double" },
      { name: "y", type: "double" },
      { name: "direction", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Slide a prop in from off screen to stage coordinates.",
  },
  {
    name: "SlideOut",
    parameters: [
      { name: "id", type: "string" },
      { name: "direction", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Slide a prop off screen and mark it hidden.",
  },
  {
    name: "Move",
    parameters: [
      { name: "id", type: "string" },
      { name: "slot", type: "string" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Animate a prop from its current position to a named slot.",
  },
  {
    name: "MoveXY",
    parameters: [
      { name: "id", type: "string" },
      { name: "x", type: "double" },
      { name: "y", type: "double" },
      { name: "durationMs", type: "int" },
    ],
    returnType: "void",
    description: "Animate a prop from its current position to stage coordinates.",
  },
  {
    name: "SetPosition",
    parameters: [
      { name: "id", type: "string" },
      { name: "slot", type: "string" },
    ],
    returnType: "void",
    description: "Move a prop to a named slot with no transition.",
  },
  {
    name: "SetPositionXY",
    parameters: [
      { name: "id", type: "string" },
      { name: "x", type: "double" },
      { name: "y", type: "double" },
    ],
    returnType: "void",
    description: "Move a prop to stage coordinates with no transition.",
  },
  {
    name: "SetZ",
    parameters: [
      { name: "id", type: "string" },
      { name: "z", type: "int" },
    ],
    returnType: "void",
    description: "Set the render order for a prop; higher values draw in front.",
  },
  {
    name: "SetVariation",
    parameters: [
      { name: "id", type: "string" },
      { name: "variationId", type: "string" },
    ],
    returnType: "void",
    description:
      "Swap the rendered variation or expression, preserving visibility, position, z layer, and opacity.",
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
  {
    id: "builtin:background",
    name: "IMuseLabBackground",
    description:
      "Scripted background lifecycle: show, clear, and transition between backdrops with automatic unloading.",
    bindingName: "bg",
    className: "MuseLabBackground",
    overridableTypescript: false,
    methods: BACKGROUND_METHODS,
  },
  {
    id: "builtin:prop",
    name: "IMuseLabProp",
    description:
      "Scripted foreground objects for characters and props: add, show, move, transition, layer, and remove.",
    bindingName: "prop",
    className: "MuseLabProp",
    overridableTypescript: false,
    methods: PROP_METHODS,
  },
];

const BUILT_IN_MODULE_IDS = new Set<string>(BUILT_IN_MODULES.map((module) => module.id));

export function isBuiltInModuleId(id: string): id is BuiltInModuleId {
  return BUILT_IN_MODULE_IDS.has(id);
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
  return /^\s*format\./.test(normalizeFormatExpression(expr.trim()));
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
