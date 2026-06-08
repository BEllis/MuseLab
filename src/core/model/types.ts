/** Asset type: backdrop (image), actor (sprite), or sound (audio) */
export type AssetType = "backdrop" | "actor" | "sound";

/** One named visual variant of an actor (e.g. happy, sad). */
export interface ActorExpression {
  id: string;
  name: string;
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
  backstory?: string;
  notes?: string;
  /** Actor only: named expression sprites; at least one required after migration. */
  expressions?: ActorExpression[];
}

/** Per-scene actor placement: which expression image to show. */
export interface ActorSceneConfig {
  assetId: string;
  expressionId: string;
}

/** Sound config per node: which sound and how it behaves when the node loads */
export interface SoundConfig {
  assetId: string;
  startOnLoad?: boolean;
  stopOnLoad?: boolean;
  loop?: boolean;
  startTime?: number;
  endTime?: number;
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

/** Cito primitive type for service method signatures. */
export type CitoType = "void" | "string" | "bool" | "int" | "double";

export interface ServiceMethodParam {
  name: string;
  type: CitoType;
}

export interface ServiceMethod {
  name: string;
  parameters: ServiceMethodParam[];
  returnType: CitoType;
}

/** User-defined service interface for Cito templates and future export targets. */
export interface ServiceInterface {
  id: string;
  /** Export name, e.g. IGameSave */
  name: string;
  /** Cito/JS binding, e.g. gameSave */
  bindingName: string;
  methods: ServiceMethod[];
  /** Optional TS implementation for preview/player */
  typescriptSource?: string;
}

/** Full project: serializable to JSON */
export interface Project {
  name: string;
  assets: Asset[];
  stories: Story[];
  /** Supported locale tags; first entry is the default */
  locales: string[];
  /** Custom service interfaces available in Cito code */
  services: ServiceInterface[];
  /** Scene thumbnail aspect ratio in the designer canvas */
  thumbnailAspectRatio?: AspectRatio;
  /** Target resolution for play mode (logical pixels) */
  playerResolution?: AspectRatio;
  /** Optional TypeScript override for IMuseLabPromptRenderer in preview/player */
  promptRendererTypescriptSource?: string;
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
