import type { Attributes } from "../model/attributes";

export { MUSELAB_SCRIPT_FORMAT_VERSION } from "../model/formatVersion";

export type ImportScriptMode = "merge" | "replace";

export interface MuseLabScriptDialogueLocale {
  speaker?: string;
  dialogue?: string;
}

export interface MuseLabScriptActor {
  actor_id?: string;
  actor_path: string;
  expression: string;
  attributes?: Attributes;
}

export interface MuseLabScriptBackdrop {
  backdrop_id?: string;
  backdrop_path: string;
}

export interface MuseLabScriptSound {
  sound_id?: string;
  sound_path: string;
  start_on_load?: boolean;
  stop_on_load?: boolean;
  loop?: boolean;
  start_time?: number;
  end_time?: number;
  attributes?: Attributes;
}

export interface MuseLabScriptOption {
  edge_id?: string;
  node_id?: string;
  node_name: string;
  label?: string;
  condition?: string;
  /** Alias for condition (draft format compatibility). */
  on_click?: string;
  attributes?: Attributes;
}

export interface MuseLabScriptScene {
  node_id?: string;
  node_name: string;
  attributes?: Attributes;
  actors?: MuseLabScriptActor[];
  backdrop?: MuseLabScriptBackdrop;
  sound?: MuseLabScriptSound;
  dialogue?: Record<string, MuseLabScriptDialogueLocale>;
  options?: MuseLabScriptOption[];
}

export interface MuseLabStoryScript {
  format_version: number;
  schema?: string;
  story_id?: string;
  story_name?: string;
  story_path?: string;
  entry_node_name?: string;
  prompt_start_template?: string;
  prompt_end_template?: string;
  speaker_start_template?: string;
  speaker_end_template?: string;
  attributes?: Attributes;
  scenes: MuseLabScriptScene[];
}

export interface MuseLabProjectScript {
  format_version: number;
  schema?: string;
  stories: MuseLabStoryScript[];
}

export type MuseLabScriptDocument = MuseLabStoryScript | MuseLabProjectScript;

export function isProjectScript(doc: MuseLabScriptDocument): doc is MuseLabProjectScript {
  return Array.isArray((doc as MuseLabProjectScript).stories);
}

export function isStoryScript(doc: MuseLabScriptDocument): doc is MuseLabStoryScript {
  return Array.isArray((doc as MuseLabStoryScript).scenes);
}
