/** Asset type: backdrop (image), actor (sprite), or sound (audio) */
export type AssetType = "backdrop" | "actor" | "sound";

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

/** Story element (node): position, optional backdrop, actors, sounds */
export interface StoryNode {
  id: string;
  position: { x: number; y: number };
  label?: string;
  backdropId: string;
  actorIds: string[];
  soundConfigs: SoundConfig[];
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

/** Full project: serializable to JSON */
export interface Project {
  name: string;
  assets: Asset[];
  stories: Story[];
  /** Supported locale tags; first entry is the default */
  locales: string[];
  /** Scene thumbnail aspect ratio in the designer canvas */
  thumbnailAspectRatio?: AspectRatio;
  /** Target resolution for play mode (logical pixels) */
  playerResolution?: AspectRatio;
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
