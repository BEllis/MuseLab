import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SceneDirector, type SceneDirectorOptions } from "@/core/scene/sceneDirector";
import type { SceneOp } from "@/core/scene/sceneOps";
import { stageViewFromSnapshot, type StageView } from "@/core/view/stageView";

export type UseSceneDirectorResult = {
  stageView: StageView;
  applySceneOp: (op: SceneOp) => Promise<void>;
  dialogueBoundary: () => void;
  reset: () => void;
};

/**
 * Owns a SceneDirector for one stage and republishes its state as a view.
 *
 * Playback drives the director through recorded scene ops; React only ever
 * reads the derived view, so the scene stays the single source of truth.
 */
export function useSceneDirector(options: SceneDirectorOptions = {}): UseSceneDirectorResult {
  const { skipTransitions, easing, scheduler, onLoadAsset, onUnloadAsset } = options;
  const director = useMemo(
    () => new SceneDirector({ skipTransitions, easing, scheduler, onLoadAsset, onUnloadAsset }),
    [skipTransitions, easing, scheduler, onLoadAsset, onUnloadAsset]
  );
  const [stageView, setStageView] = useState<StageView>(() =>
    stageViewFromSnapshot(director.getSnapshot())
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setStageView(stageViewFromSnapshot(director.getSnapshot()));
    const unsubscribe = director.subscribe(() => {
      setStageView(stageViewFromSnapshot(director.getSnapshot()));
    });
    const controller = new AbortController();
    abortRef.current = controller;
    return () => {
      controller.abort();
      unsubscribe();
      director.reset();
    };
  }, [director]);

  const applySceneOp = useCallback(
    async (op: SceneOp) => {
      try {
        await director.applyOp(op, abortRef.current?.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      }
    },
    [director]
  );

  const dialogueBoundary = useCallback(() => {
    director.dialogueBoundary();
  }, [director]);

  const reset = useCallback(() => {
    director.reset();
  }, [director]);

  return { stageView, applySceneOp, dialogueBoundary, reset };
}
