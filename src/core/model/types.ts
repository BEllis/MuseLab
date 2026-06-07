/** Asset type: backdrop (image), actor (sprite), or sound (audio) */
export type AssetType = "backdrop" | "actor" | "sound";

/** Stored asset reference: id, type, name, and either path (Electron) or url (web) */
export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  /** File path (Electron) or relative path in project */
  path?: string;
  /** Data URL (web, legacy) or blob URL (web, ephemeral — prefer file for persistence) */
  url?: string;
  /** Base64 image bytes for actors; embedded in saved project JSON. */
  imageData?: string;
  /** MIME type for imageData, e.g. image/png */
  imageMimeType?: string;
  /** Web: binary media is stored in IndexedDB under this asset id. */
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

/** Story element (node): position, optional backdrop, actors, sounds, text template */
export interface StoryNode {
  id: string;
  position: { x: number; y: number };
  label?: string;
  backdropId: string;
  actorIds: string[];
  soundConfigs: SoundConfig[];
  textTemplate: string;
}

/** Link between nodes; optional option text and condition for player choices */
export interface StoryEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePortId?: string;
  targetPortId?: string;
  optionText?: string;
  condition?: string;
  /** User-defined bend points; when present the edge stops auto-routing. */
  vertices?: { x: number; y: number }[];
  /** True once the user has manually shaped this edge. */
  manualRoute?: boolean;
}

/** Full project: serializable to JSON */
export interface Project {
  name: string;
  assets: Asset[];
  nodes: StoryNode[];
  edges: StoryEdge[];
  /** Initial state for the runtime (variables, flags) */
  globalState: Record<string, unknown>;
  /** Optional: id of the entry node; otherwise first node */
  entryNodeId?: string;
}
