import type { Attributes } from "./attributes";

export type { AttributeValue, AttributeValueType, Attributes } from "./attributes";

/** Asset type: backdrop (image), actor (sprite), or sound (audio) */
export type AssetType = "backdrop" | "actor" | "sound";

/** One named visual variant of an actor (e.g. happy, sad). */
export interface ActorExpression {
  id: string;
  name: string;
  /** Sibling order within the parent actor. */
  sortOrder?: number;
  /** Archive-relative path, e.g. assets/actors/{actorId}/{expressionId}.png */
  path?: string;
  /** Built-in placeholder data URL only; omitted from saved MLVN manifests. */
  url?: string;
  /** Legacy JSON import: base64 media bytes before hydration. */
  imageData?: string;
  /** Legacy JSON import: MIME type for imageData. */
  imageMimeType?: string;
  /** Web runtime: binary media stored in IndexedDB under actorId:expressionId. */
  blobStored?: boolean;
  /** Optional custom export metadata (animations, colors, etc.). */
  attributes?: Attributes;
}

/** Stored asset reference: id, type, name, and media location metadata. */
export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  /** Absolute path (Electron) or archive-relative path in saved MLVN manifests. */
  path?: string;
  /** Built-in default backdrop data URL only; omitted from saved MLVN manifests. */
  url?: string;
  /** Legacy JSON import: base64 media bytes before hydration. */
  imageData?: string;
  /** Legacy JSON import: MIME type for imageData. */
  imageMimeType?: string;
  /** Web runtime: binary media stored in IndexedDB under this asset id. */
  blobStored?: boolean;
  /** Actor only: designer notes for AI / reference. */
  personality?: string;
  appearance?: string;
  voiceAccent?: string;
  backstory?: string;
  notes?: string;
  /** Actor only: named expression sprites; at least one required after migration. */
  expressions?: ActorExpression[];
  /** Actor only: expression used when no specific expression is chosen. */
  defaultExpressionId?: string;
  /** Optional asset group for hierarchy in the Assets panel tree. */
  groupId?: string;
  /** Sibling order within a folder or at the type root. */
  sortOrder?: number;
  /** Optional custom export metadata (animations, colors, etc.). */
  attributes?: Attributes;
}

/** Folder node for organizing assets in the Assets panel tree. */
export interface AssetGroup {
  id: string;
  name: string;
  assetType: AssetType;
  /** Parent folder id; omitted for root-level groups within a type section. */
  parentGroupId?: string;
  /** Sibling order within a parent folder or at the type root. */
  sortOrder?: number;
}

/** Per-scene actor placement: which expression image to show. */
export interface ActorSceneConfig {
  assetId: string;
  expressionId: string;
  /** Optional per-scene placement metadata (position, animation overrides, etc.). */
  attributes?: Attributes;
}

/** Sound config per node: which sound and how it behaves when the node loads */
export interface SoundConfig {
  assetId: string;
  startOnLoad?: boolean;
  stopOnLoad?: boolean;
  loop?: boolean;
  startTime?: number;
  endTime?: number;
  /** Optional per-slot playback metadata. */
  attributes?: Attributes;
}

export type StoryNodeType = "start" | "scene" | "jump";

/** Story element (node): typed start, scene, or jump */
export interface StoryNode {
  id: string;
  type: StoryNodeType;
  position: { x: number; y: number };
  label?: string;
  /** Scene nodes only */
  backdropId?: string;
  actorConfigs?: ActorSceneConfig[];
  soundConfigs?: SoundConfig[];
  /** Jump nodes only */
  jumpTargetStoryId?: string;
  jumpTargetStartNodeId?: string;
  /** Optional custom export metadata. */
  attributes?: Attributes;
}

/** Link between nodes; optional condition for player choices */
export interface StoryEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePortId?: string;
  targetPortId?: string;
  condition?: string;
  /** User-defined bend points; when present the edge stops auto-routing. */
  vertices?: { x: number; y: number }[];
  /** True once the user has manually shaped this edge. */
  manualRoute?: boolean;
  /** Optional custom export metadata. */
  attributes?: Attributes;
}

/** Designer layout for a synthetic End node attached to a terminal scene. */
export interface EndNodeLayout {
  position: { x: number; y: number };
  vertices?: { x: number; y: number }[];
  manualRoute?: boolean;
}

/** Per-story graph: scenes, links, and runtime initial state. */
export interface Story {
  id: string;
  name: string;
  nodes: StoryNode[];
  edges: StoryEdge[];
  /** Initial state for the runtime (variables, flags) */
  globalState: Record<string, unknown>;
  /** Optional: id of the entry node; otherwise first node */
  entryNodeId?: string;
  /** Terminal-scene End node layout keyed by scene id (designer-only). */
  endNodeLayouts?: Record<string, EndNodeLayout>;
  /** Optional story group for hierarchy in the Stories panel. */
  groupId?: string;
  /** Sibling order within a folder or at the project root. */
  sortOrder?: number;
  /** Template prepended to every scene prompt before rendering. */
  promptStartTemplate?: string;
  /** Template appended to every scene prompt before rendering. */
  promptEndTemplate?: string;
  /** Template prepended to every speaker name before rendering. */
  speakerStartTemplate?: string;
  /** Template appended to every speaker name before rendering. */
  speakerEndTemplate?: string;
  /** Optional custom export metadata. */
  attributes?: Attributes;
}

/** Folder node for organizing stories in the Stories panel tree. */
export interface StoryGroup {
  id: string;
  name: string;
  /** Parent folder id; omitted for root-level groups. */
  parentGroupId?: string;
  /** Sibling order within a parent folder or at the project root. */
  sortOrder?: number;
}

/** Supported language entry in a project manifest. */
export interface Locale {
  id: string;
  /** BCP 47-style locale tag (lowercase letters and hyphens). */
  locale: string;
  displayName: string;
}

/** Localized text content stored in prompts.<locale>.json */
export interface StoryPrompts {
  nodes: Record<string, { textTemplate?: string; speaker?: string }>;
  edges: Record<string, { optionText?: string }>;
}

export interface LocalePrompts {
  stories: Record<string, StoryPrompts>;
}

/** Aspect ratio stored as width:height integers (e.g. 16:9). */
export interface AspectRatio {
  width: number;
  height: number;
}

/** Cito primitive type for module method signatures. */
export type CitoType = "void" | "string" | "bool" | "int" | "double";

export interface ModuleMethodParam {
  name: string;
  type: CitoType;
}

export interface ModuleMethod {
  name: string;
  parameters: ModuleMethodParam[];
  returnType: CitoType;
  /** Human-readable summary for the module editor and tooling. */
  description?: string;
}

/** User-defined module interface for Cito templates and future export targets. */
export interface ModuleInterface {
  id: string;
  /** Export name, e.g. IGameSave */
  name: string;
  /** Cito/JS binding, e.g. gameSave */
  bindingName: string;
  /** Human-readable summary for the module editor and tooling. */
  description?: string;
  methods: ModuleMethod[];
  /** Optional TS implementation for preview/player */
  typescriptSource?: string;
}

/** Full project: serializable to JSON */
export interface Project {
  name: string;
  assets: Asset[];
  stories: Story[];
  /** Optional hierarchy folders for the Stories panel. */
  storyGroups?: StoryGroup[];
  /** Optional hierarchy folders for the Assets panel tree. */
  assetGroups?: AssetGroup[];
  /** Supported locales in alphabetical order by locale tag. */
  locales: Locale[];
  /** Default locale tag; must appear in locales. */
  defaultLocale?: string;
  /** Custom module interfaces available in Cito code */
  modules: ModuleInterface[];
  /** Scene thumbnail aspect ratio in the designer canvas */
  thumbnailAspectRatio?: AspectRatio;
  /** Target resolution for play mode (logical pixels) */
  playerResolution?: AspectRatio;
  /** Optional TypeScript override for IMuseLabPromptRenderer in preview/player */
  promptRendererTypescriptSource?: string;
  /** Optional project-wide export metadata. */
  attributes?: Attributes;
}

/** Slice passed to runtime and play validation for one story. */
export interface StoryRuntimeContext {
  nodes: StoryNode[];
  edges: StoryEdge[];
  globalState: Record<string, unknown>;
  entryNodeId?: string;
  assets: Asset[];
  locales: string[];
}
