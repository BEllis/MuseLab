import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PromptInstruction } from "@/core/prompt/promptInstructions";
import { promptInstructionsNeedExecutor } from "@/core/prompt/promptInstructions";
import {
  executePromptInstructions,
  type PromptExecutionCheckpoint,
} from "@/core/prompt/executePromptInstructions";

export type DialoguePlaybackGate = {
  totalLines: number;
  linesOnPage: number;
  startLineIndex: number;
  hasOffscreenLines: boolean;
  shouldPausePlayback: boolean;
};

export type PromptInstructionExecutorProps = {
  fullHtml: string;
  instructions: PromptInstruction[];
  playbackGateRef?: RefObject<DialoguePlaybackGate | undefined>;
  onPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
  onComplete?: () => void;
  onSkipChange?: (skipped: boolean) => void;
  children: (props: {
    visibleHtml: string;
    isComplete: boolean;
    isAwaitingContinue: boolean;
    skip: () => void;
    resume: () => void;
  }) => React.ReactNode;
};

export function shouldUsePromptExecutor(instructions: PromptInstruction[]): boolean {
  return promptInstructionsNeedExecutor(instructions);
}

export function PromptInstructionExecutor({
  fullHtml,
  instructions,
  playbackGateRef,
  onPlaySound,
  onComplete,
  onSkipChange,
  children,
}: PromptInstructionExecutorProps) {
  const [visibleHtml, setVisibleHtml] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isAwaitingContinue, setIsAwaitingContinue] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const checkpointRef = useRef<PromptExecutionCheckpoint | null>(null);
  const continueResolverRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onPlaySoundRef = useRef(onPlaySound);
  const onSkipChangeRef = useRef(onSkipChange);
  onCompleteRef.current = onComplete;
  onPlaySoundRef.current = onPlaySound;
  onSkipChangeRef.current = onSkipChange;
  const instructionsKey = JSON.stringify(instructions);

  const runSounds = useCallback((pending: PromptInstruction[]) => {
    for (const instruction of pending) {
      if (instruction.kind !== "playSound") continue;
      const trim: { startTime?: number; endTime?: number } = {};
      if (instruction.startTime !== undefined) trim.startTime = instruction.startTime;
      if (instruction.endTime !== undefined) trim.endTime = instruction.endTime;
      onPlaySoundRef.current?.(
        instruction.assetId,
        Object.keys(trim).length > 0 ? trim : undefined
      );
    }
  }, []);

  const waitForContinue = useCallback(() => {
    return new Promise<void>((resolve) => {
      setIsAwaitingContinue(true);
      continueResolverRef.current = () => {
        setIsAwaitingContinue(false);
        continueResolverRef.current = null;
        resolve();
      };
    });
  }, []);

  const resume = useCallback(() => {
    continueResolverRef.current?.();
  }, []);

  const skip = useCallback(() => {
    abortRef.current?.abort();
    continueResolverRef.current?.();
    setVisibleHtml(fullHtml);
    setIsComplete(true);
    setIsAwaitingContinue(false);
    onSkipChangeRef.current?.(true);
    runSounds(instructions.filter((instruction) => instruction.kind === "playSound"));
    onCompleteRef.current?.();
  }, [fullHtml, instructions, runSounds]);

  useEffect(() => {
    abortRef.current?.abort();
    continueResolverRef.current?.();
    const controller = new AbortController();
    abortRef.current = controller;
    checkpointRef.current = null;
    setIsComplete(false);
    setIsAwaitingContinue(false);
    onSkipChangeRef.current?.(false);

    if (!shouldUsePromptExecutor(instructions)) {
      setVisibleHtml(fullHtml);
      setIsComplete(true);
      onCompleteRef.current?.();
      return () => {
        controller.abort();
      };
    }

    setVisibleHtml("");

    void executePromptInstructions({
      instructions,
      checkpoint: checkpointRef.current ?? undefined,
      onCheckpoint: (checkpoint) => {
        checkpointRef.current = checkpoint;
      },
      signal: controller.signal,
      onHtmlUpdate: setVisibleHtml,
      onPlaySound: (assetId, options) => {
        onPlaySoundRef.current?.(assetId, options);
      },
      shouldPause: () => playbackGateRef?.current?.shouldPausePlayback ?? false,
      waitForContinue,
    })
      .then(() => {
        if (!controller.signal.aborted) {
          setVisibleHtml(fullHtml);
          setIsComplete(true);
          setIsAwaitingContinue(false);
          onCompleteRef.current?.();
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      });

    return () => {
      controller.abort();
      continueResolverRef.current?.();
    };
  }, [fullHtml, instructionsKey, waitForContinue]);

  return (
    <>
      {children({
        visibleHtml,
        isComplete,
        isAwaitingContinue,
        skip,
        resume,
      })}
    </>
  );
}
