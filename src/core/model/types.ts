/** Asset type: backdrop (image), actor (sprite), or sound (audio) */
export type AssetType = "backdrop" | "actor" | "sound";

/** Stored asset reference: id, type, name, and either path (Electron) or url (web) */
export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  /** File path (Electron) or relative path in project */
  path?: string;
  /** Data URL or blob URL (web) */
  url?: string;
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
  backdropId: string | null;
  actorIds: string[];
  soundConfigs: SoundConfig[];
  textTemplate: string;
}

/** Link between nodes; optional option text and condition for player choices */
export interface StoryEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  optionText?: string;
  condition?: string;
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
