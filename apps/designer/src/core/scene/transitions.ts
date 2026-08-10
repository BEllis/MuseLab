export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export function applyEasing(easing: Easing, t: number): number {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  switch (easing) {
    case "easeIn":
      return clamped * clamped;
    case "easeOut":
      return clamped * (2 - clamped);
    case "easeInOut":
      return clamped < 0.5
        ? 2 * clamped * clamped
        : -1 + (4 - 2 * clamped) * clamped;
    case "linear":
    default:
      return clamped;
  }
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Frame source for transitions. Injected so previews, tests, and thumbnails can
 * run the same transition code without depending on a real animation loop.
 */
export type FrameScheduler = {
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(handle: number): void;
};

export const rafScheduler: FrameScheduler = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  requestFrame: (callback) => {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(callback);
    }
    return setTimeout(
      () => callback(typeof performance !== "undefined" ? performance.now() : Date.now()),
      16
    ) as unknown as number;
  },
  cancelFrame: (handle) => {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  },
};

/** Scheduler that finishes every transition on its first update. */
export const instantScheduler: FrameScheduler = {
  now: () => 0,
  requestFrame: (callback) => {
    callback(Number.MAX_SAFE_INTEGER);
    return 0;
  },
  cancelFrame: () => {},
};

export type TweenOptions = {
  durationMs: number;
  easing?: Easing;
  /** Called with eased progress 0..1, always ending on exactly 1. */
  onUpdate: (progress: number) => void;
  scheduler?: FrameScheduler;
  signal?: AbortSignal;
};

/**
 * Single reusable interpolation primitive. Every fade, move, slide, and
 * background transition drives its state through this rather than owning a loop.
 */
export function runTween(options: TweenOptions): Promise<void> {
  const { durationMs, easing = "linear", onUpdate, signal } = options;
  const scheduler = options.scheduler ?? rafScheduler;

  if (durationMs <= 0) {
    onUpdate(1);
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const start = scheduler.now();
    let handle: number | null = null;

    const cleanup = () => {
      if (handle !== null) scheduler.cancelFrame(handle);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    const step = (time: number) => {
      const elapsed = time - start;
      const linear = elapsed / durationMs;
      if (linear >= 1) {
        onUpdate(1);
        cleanup();
        resolve();
        return;
      }
      onUpdate(applyEasing(easing, linear));
      handle = scheduler.requestFrame(step);
    };

    handle = scheduler.requestFrame(step);
  });
}
