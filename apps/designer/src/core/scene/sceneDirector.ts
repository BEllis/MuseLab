import { DEFAULT_DIALOGUE_WIDTH_PERCENT, DEFAULT_PROP_Z } from "./actions";
import { AssetReferenceCounter, assetReferenceKey } from "./assetReferences";
import {
  offstagePosition,
  resolvePosition,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type Direction,
  type StagePosition,
  type StageVector,
} from "./positions";
import type { SceneOp } from "./sceneOps";
import { lerp, rafScheduler, runTween, type Easing, type FrameScheduler } from "./transitions";

export type ScenePropState = {
  id: string;
  assetId: string;
  variationId?: string;
  /** Reference key for the currently rendered asset. */
  assetKey: string;
  /** Authored destination: named slot or explicit coordinates. */
  position: StagePosition;
  /** Live stage coordinates, which a transition may be interpolating. */
  x: number;
  y: number;
  visible: boolean;
  opacity: number;
  zIndex: number;
  scale: number;
  highlighted: boolean;
};

export type SceneBackgroundState = {
  assetId: string;
  assetKey: string;
  opacity: number;
  /** Slide offset in stage units; 0,0 is fully on screen. */
  offsetX: number;
  offsetY: number;
};

export type SceneSnapshot = {
  background: SceneBackgroundState | null;
  /** Retained only while a background transition is running. */
  outgoingBackground: SceneBackgroundState | null;
  /** Ordered back to front. */
  props: ScenePropState[];
  /** When false, the dialogue box is hidden even if it has text. Defaults true. */
  dialogueVisible: boolean;
  /** Optional actor id for later per-character dialogue theming. */
  dialogueCharacterId?: string;
  /** Dialogue box width as a percent of stage width. */
  dialogueWidthPercent: number;
  loadedAssetKeys: string[];
};

export type SceneDirectorOptions = {
  scheduler?: FrameScheduler;
  /** Complete every transition immediately; used by previews and tests. */
  skipTransitions?: boolean;
  easing?: Easing;
  onLoadAsset?: (key: string) => void;
  onUnloadAsset?: (key: string) => void;
};

export class SceneActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneActionError";
  }
}

function missingProp(id: string, verb: string): SceneActionError {
  return new SceneActionError(
    `Cannot ${verb} prop '${id}': no active prop with this ID exists. Call Prop.Add(...) before attempting to ${verb} it.`
  );
}

/**
 * Owns the authoritative scene state.
 *
 * Every visual action resolves against this state rather than poking renderer
 * objects directly, so transitions always know where they are starting from.
 */
export class SceneDirector {
  private background: SceneBackgroundState | null = null;
  private outgoing: SceneBackgroundState | null = null;
  private readonly props = new Map<string, ScenePropState>();
  private dialogueVisible = true;
  private dialogueCharacterId: string | undefined;
  private dialogueWidthPercent = DEFAULT_DIALOGUE_WIDTH_PERCENT;
  private backgroundTweenAbort: AbortController | null = null;
  private readonly assets: AssetReferenceCounter;
  private readonly listeners = new Set<() => void>();
  private readonly scheduler: FrameScheduler;
  private readonly skipTransitions: boolean;
  private readonly easing: Easing;
  private cachedSnapshot: SceneSnapshot | null = null;

  constructor(options: SceneDirectorOptions = {}) {
    this.scheduler = options.scheduler ?? rafScheduler;
    this.skipTransitions = options.skipTransitions ?? false;
    this.easing = options.easing ?? "easeInOut";
    this.assets = new AssetReferenceCounter({
      onLoad: options.onLoadAsset,
      onUnload: options.onUnloadAsset,
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): SceneSnapshot {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = {
        background: this.background ? { ...this.background } : null,
        outgoingBackground: this.outgoing ? { ...this.outgoing } : null,
        props: [...this.props.values()]
          .map((prop) => ({ ...prop }))
          .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)),
        dialogueVisible: this.dialogueVisible,
        dialogueCharacterId: this.dialogueCharacterId,
        dialogueWidthPercent: this.dialogueWidthPercent,
        loadedAssetKeys: this.assets.loadedKeys().sort(),
      };
    }
    return this.cachedSnapshot;
  }

  /** Props that currently exist in the scene, visible or not. */
  getProp(id: string): ScenePropState | undefined {
    const prop = this.props.get(id);
    return prop ? { ...prop } : undefined;
  }

  isAssetLoaded(assetId: string, variationId?: string): boolean {
    return this.assets.isLoaded(assetReferenceKey(assetId, variationId));
  }

  isDialogueVisible(): boolean {
    return this.dialogueVisible;
  }

  private cancelBackgroundTween(): void {
    this.backgroundTweenAbort?.abort();
    this.backgroundTweenAbort = null;
  }

  /** Abort an in-flight background fade and snap it to the end state. */
  private settleBackgroundTransition(): void {
    this.cancelBackgroundTween();
    if (this.outgoing) this.finishBackgroundTransition();
  }

  private runBackgroundTween(
    durationMs: number,
    onUpdate: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const controller = new AbortController();
    this.backgroundTweenAbort = controller;
    const onAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", onAbort, { once: true });

    const run = async () => {
      try {
        await this.tween(durationMs, onUpdate, controller.signal);
        if (this.backgroundTweenAbort === controller) {
          this.backgroundTweenAbort = null;
          this.finishBackgroundTransition();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
    };

    if (this.skipTransitions) return run();
    void run();
    return Promise.resolve();
  }

  private notify(): void {
    this.cachedSnapshot = null;
    for (const listener of this.listeners) listener();
  }

  private tween(
    durationMs: number,
    onUpdate: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return runTween({
      durationMs: this.skipTransitions ? 0 : durationMs,
      easing: this.easing,
      scheduler: this.scheduler,
      signal,
      onUpdate: (progress) => {
        onUpdate(progress);
        this.notify();
      },
    });
  }

  private requireProp(id: string, verb: string): ScenePropState {
    const prop = this.props.get(id);
    if (!prop) throw missingProp(id, verb);
    return prop;
  }

  private makeBackground(assetId: string, opacity: number, offset: StageVector): SceneBackgroundState {
    const assetKey = assetReferenceKey(assetId);
    this.assets.acquire(assetKey);
    return { assetId, assetKey, opacity, offsetX: offset.x, offsetY: offset.y };
  }

  private releaseBackground(background: SceneBackgroundState | null): void {
    if (background) this.assets.release(background.assetKey);
  }

  private beginBackgroundTransition(assetId: string, offset: StageVector, opacity: number): void {
    this.outgoing = this.background;
    this.background = this.makeBackground(assetId, opacity, offset);
  }

  private finishBackgroundTransition(): void {
    this.releaseBackground(this.outgoing);
    this.outgoing = null;
    if (this.background) {
      this.background.opacity = 1;
      this.background.offsetX = 0;
      this.background.offsetY = 0;
    }
    this.notify();
  }

  /** Offscreen slide offset in stage units for a direction the asset enters from. */
  private slideOffset(direction: Direction): StageVector {
    const from = offstagePosition({ x: 0, y: 0 }, direction);
    return {
      x: direction === "Top" || direction === "Bottom" ? 0 : from.x > 0 ? STAGE_WIDTH : -STAGE_WIDTH,
      y:
        direction === "Left" || direction === "Right"
          ? 0
          : from.y > 0
            ? STAGE_HEIGHT
            : -STAGE_HEIGHT,
    };
  }

  async applyOp(op: SceneOp, signal?: AbortSignal): Promise<void> {
    switch (op.kind) {
      case "bg.show": {
        this.settleBackgroundTransition();
        const previous = this.background;
        this.background = this.makeBackground(op.assetId, 1, { x: 0, y: 0 });
        this.releaseBackground(previous);
        this.notify();
        return;
      }

      case "bg.clear": {
        this.settleBackgroundTransition();
        this.releaseBackground(this.background);
        this.releaseBackground(this.outgoing);
        this.background = null;
        this.outgoing = null;
        this.notify();
        return;
      }

      case "bg.fade": {
        this.settleBackgroundTransition();
        this.beginBackgroundTransition(op.assetId, { x: 0, y: 0 }, 0);
        const incoming = this.background;
        const outgoing = this.outgoing;
        this.notify();
        await this.runBackgroundTween(
          op.durationMs,
          (progress) => {
            if (incoming) incoming.opacity = progress;
            if (outgoing) outgoing.opacity = 1 - progress;
          },
          signal
        );
        return;
      }

      case "bg.slideIn": {
        this.settleBackgroundTransition();
        const offset = this.slideOffset(op.direction);
        this.beginBackgroundTransition(op.assetId, offset, 1);
        const incoming = this.background;
        this.notify();
        await this.tween(
          op.durationMs,
          (progress) => {
            if (!incoming) return;
            incoming.offsetX = lerp(offset.x, 0, progress);
            incoming.offsetY = lerp(offset.y, 0, progress);
          },
          signal
        );
        this.finishBackgroundTransition();
        return;
      }

      case "bg.slideOut": {
        this.settleBackgroundTransition();
        const current = this.background;
        if (!current) return;
        const offset = this.slideOffset(op.direction);
        await this.tween(
          op.durationMs,
          (progress) => {
            current.offsetX = lerp(0, -offset.x, progress);
            current.offsetY = lerp(0, -offset.y, progress);
          },
          signal
        );
        this.releaseBackground(current);
        if (this.background === current) this.background = null;
        this.notify();
        return;
      }

      case "prop.add": {
        if (this.props.has(op.id)) {
          throw new SceneActionError(
            `Cannot add prop '${op.id}': a prop with this ID already exists in the scene. Use a different instance id or call Prop.Remove first.`
          );
        }
        const assetKey = assetReferenceKey(op.assetId, op.variationId);
        this.assets.acquire(assetKey);
        const position: StagePosition = { kind: "slot", slot: "Centre" };
        const coords = resolvePosition(position);
        this.props.set(op.id, {
          id: op.id,
          assetId: op.assetId,
          variationId: op.variationId,
          assetKey,
          position,
          x: coords.x,
          y: coords.y,
          visible: false,
          opacity: 1,
          zIndex: DEFAULT_PROP_Z,
          scale: 1,
          highlighted: false,
        });
        this.notify();
        return;
      }

      case "prop.remove": {
        const prop = this.requireProp(op.id, "remove");
        this.assets.release(prop.assetKey);
        this.props.delete(op.id);
        this.notify();
        return;
      }

      case "prop.show": {
        const prop = this.requireProp(op.id, "show");
        if (op.position) this.setPropPosition(prop, op.position);
        prop.visible = true;
        prop.opacity = 1;
        this.notify();
        return;
      }

      case "prop.hide": {
        const prop = this.requireProp(op.id, "hide");
        prop.visible = false;
        this.notify();
        return;
      }

      case "prop.fadeIn": {
        const prop = this.requireProp(op.id, "fade in");
        if (op.position) this.setPropPosition(prop, op.position);
        prop.visible = true;
        prop.opacity = 0;
        this.notify();
        await this.tween(op.durationMs, (progress) => {
          prop.opacity = progress;
        }, signal);
        prop.opacity = 1;
        this.notify();
        return;
      }

      case "prop.fadeOut": {
        const prop = this.requireProp(op.id, "fade out");
        const from = prop.opacity;
        await this.tween(op.durationMs, (progress) => {
          prop.opacity = lerp(from, 0, progress);
        }, signal);
        prop.opacity = 0;
        prop.visible = false;
        this.notify();
        return;
      }

      case "prop.slideIn": {
        const prop = this.requireProp(op.id, "slide in");
        const target = resolvePosition(op.position);
        const start = offstagePosition(target, op.direction);
        prop.position = op.position;
        prop.x = start.x;
        prop.y = start.y;
        prop.visible = true;
        prop.opacity = 1;
        this.notify();
        await this.tween(op.durationMs, (progress) => {
          prop.x = lerp(start.x, target.x, progress);
          prop.y = lerp(start.y, target.y, progress);
        }, signal);
        prop.x = target.x;
        prop.y = target.y;
        this.notify();
        return;
      }

      case "prop.slideOut": {
        const prop = this.requireProp(op.id, "slide out");
        const start = { x: prop.x, y: prop.y };
        const target = offstagePosition(start, op.direction);
        await this.tween(op.durationMs, (progress) => {
          prop.x = lerp(start.x, target.x, progress);
          prop.y = lerp(start.y, target.y, progress);
        }, signal);
        prop.visible = false;
        // Restore the authored position so a later Show does not appear offscreen.
        const restored = resolvePosition(prop.position);
        prop.x = restored.x;
        prop.y = restored.y;
        this.notify();
        return;
      }

      case "prop.move": {
        const prop = this.requireProp(op.id, "move");
        const start = { x: prop.x, y: prop.y };
        const target = resolvePosition(op.position);
        await this.tween(op.durationMs, (progress) => {
          prop.x = lerp(start.x, target.x, progress);
          prop.y = lerp(start.y, target.y, progress);
        }, signal);
        prop.position = op.position;
        prop.x = target.x;
        prop.y = target.y;
        this.notify();
        return;
      }

      case "prop.setPosition": {
        const prop = this.requireProp(op.id, "position");
        this.setPropPosition(prop, op.position);
        this.notify();
        return;
      }

      case "prop.setZ": {
        const prop = this.requireProp(op.id, "set the z layer of");
        prop.zIndex = Math.trunc(op.z);
        this.notify();
        return;
      }

      case "prop.setVariation": {
        const prop = this.requireProp(op.id, "set the variation of");
        const nextKey = assetReferenceKey(prop.assetId, op.variationId);
        if (nextKey === prop.assetKey) return;
        this.assets.acquire(nextKey);
        this.assets.release(prop.assetKey);
        prop.assetKey = nextKey;
        prop.variationId = op.variationId;
        this.notify();
        return;
      }

      case "prop.highlight": {
        const prop = this.requireProp(op.id, "highlight");
        prop.highlighted = true;
        this.notify();
        return;
      }

      case "prop.unhighlight": {
        const prop = this.requireProp(op.id, "remove the highlight from");
        prop.highlighted = false;
        this.notify();
        return;
      }

      case "dialogue.show": {
        this.dialogueVisible = true;
        this.dialogueCharacterId = op.characterId;
        this.notify();
        return;
      }

      case "dialogue.hide": {
        this.dialogueVisible = false;
        this.notify();
        return;
      }

      case "dialogue.setWidth": {
        if (
          !Number.isInteger(op.widthPercent) ||
          op.widthPercent < 1 ||
          op.widthPercent > 100
        ) {
          throw new SceneActionError(
            `Dialogue width must be an integer from 1 to 100 percent, got ${op.widthPercent}.`
          );
        }
        this.dialogueWidthPercent = op.widthPercent;
        this.notify();
        return;
      }

      default: {
        const exhaustive: never = op;
        throw new SceneActionError(`Unsupported scene operation: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  private setPropPosition(prop: ScenePropState, position: StagePosition): void {
    const coords = resolvePosition(position);
    prop.position = position;
    prop.x = coords.x;
    prop.y = coords.y;
  }

  /**
   * Dialogue boundary cleanup: any prop still hidden is destroyed and its asset
   * released, so scripts cannot rely on hidden props surviving between lines.
   */
  dialogueBoundary(): string[] {
    const removed: string[] = [];
    for (const [id, prop] of [...this.props.entries()]) {
      if (prop.visible) continue;
      this.assets.release(prop.assetKey);
      this.props.delete(id);
      removed.push(id);
    }
    if (removed.length > 0) this.notify();
    return removed;
  }

  /** Drop the whole stage, releasing every asset reference. */
  reset(): void {
    this.cancelBackgroundTween();
    this.props.clear();
    this.background = null;
    this.outgoing = null;
    this.dialogueVisible = true;
    this.dialogueCharacterId = undefined;
    this.dialogueWidthPercent = DEFAULT_DIALOGUE_WIDTH_PERCENT;
    this.assets.releaseAll();
    this.notify();
  }
}
