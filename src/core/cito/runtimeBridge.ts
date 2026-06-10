import type { Project } from "../model/types";
import type { PromptInstructionRecorder } from "../prompt/promptInstructions";
import {
  resolveSoundAssetId,
  resolveSoundAssetIdById,
} from "../assets/resolveSoundAsset";

/** Context passed to template/condition evaluation (author-facing bridge is MuseLabRuntime). */
export type TemplateContext = {
  state: Record<string, unknown>;
  setState: (path: string, value: unknown) => void;
  emit: (eventName: string) => void;
  call: (name: string, ...args: unknown[]) => unknown;
  playSound: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
  project: Project;
  instructionRecorder?: PromptInstructionRecorder;
};

/** Runtime bridge matching transpiled Cito camelCase method names. */
export type MuseLabRuntimeBridge = {
  getString: (key: string) => string;
  getBool: (key: string) => boolean;
  getInt: (key: string) => number;
  setString: (key: string, value: string) => void;
  setBool: (key: string, value: boolean) => void;
  setInt: (key: string, value: number) => void;
  emit: (eventName: string) => void;
  call: (name: string) => string;
  playSound: (assetId: string) => void;
  playSoundTrim: (assetId: string, startTime: number, endTime: number) => void;
  playSoundClip: (assetId: string, delaySeconds: number, startTime: number, endTime: number) => void;
  playSoundClipByPath: (
    groupPath: string,
    assetName: string,
    delaySeconds: number,
    startTime: number,
    endTime: number
  ) => void;
};

function readString(state: Record<string, unknown>, key: string): string {
  const value = state[key];
  if (value === undefined || value === null) return "";
  return String(value);
}

function readBool(state: Record<string, unknown>, key: string): boolean {
  return Boolean(state[key]);
}

function readInt(state: Record<string, unknown>, key: string): number {
  const value = state[key];
  if (typeof value === "number") return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function schedulePlaySoundClip(
  context: TemplateContext,
  assetId: string,
  delaySeconds: number,
  startTime: number,
  endTime: number
): void {
  const recorder = context.instructionRecorder;
  if (!recorder) {
    throw new Error("PlaySoundClip requires the default prompt instruction recorder");
  }
  const resolvedId = resolveSoundAssetIdById(context.project, assetId);
  recorder.playSound(resolvedId, delaySeconds, startTime, endTime);
}

export function createMuseLabRuntimeBridge(context: TemplateContext): MuseLabRuntimeBridge {
  return {
    getString: (key) => readString(context.state, key),
    getBool: (key) => readBool(context.state, key),
    getInt: (key) => readInt(context.state, key),
    setString: (key, value) => {
      context.setState(key, value);
    },
    setBool: (key, value) => {
      context.setState(key, value);
    },
    setInt: (key, value) => {
      context.setState(key, value);
    },
    emit: (eventName) => {
      context.emit(eventName);
    },
    call: (name) => {
      const result = context.call(name);
      if (result === undefined || result === null) return "";
      return String(result);
    },
    playSound: (assetId) => {
      context.playSound(assetId);
    },
    playSoundTrim: (assetId, startTime, endTime) => {
      context.playSound(assetId, { startTime, endTime });
    },
    playSoundClip: (assetId, delaySeconds, startTime, endTime) => {
      schedulePlaySoundClip(context, assetId, delaySeconds, startTime, endTime);
    },
    playSoundClipByPath: (groupPath, assetName, delaySeconds, startTime, endTime) => {
      const recorder = context.instructionRecorder;
      if (!recorder) {
        throw new Error("PlaySoundClipByPath requires the default prompt instruction recorder");
      }
      const resolvedId = resolveSoundAssetId(context.project, groupPath, assetName);
      recorder.playSound(resolvedId, delaySeconds, startTime, endTime);
    },
  };
}
