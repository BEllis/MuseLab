import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PromptInstruction } from "@/core/prompt/promptInstructions";
import { promptInstructionsNeedExecutor } from "@/core/prompt/promptInstructions";
import {
  executePromptInstructions,
  renderFinalSpeakerHtml,
  type PromptExecutionCheckpoint,
  type RevealSkipControl,
} from "@/core/prompt/executePromptInstructions";

export type DialoguePlaybackGate = {
  totalLines: number;
  linesOnPage: number;
  startLineIndex: number;
  hasOffscreenLines: boolean;
  shouldPausePlayback: boolean;
  measuredForHtmlLength: number;
};

export type PromptInstructionExecutorProps = {
  fullHtml: string;
  initialSpeakerHtml?: string;
  instructions: PromptInstruction[];
  renderSpeakerTemplate?: (template: string) => Promise<string>;
  playbackGateRef?: RefObject<DialoguePlaybackGate | undefined>;
  onPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
  onComplete?: () => void;
  onSkipChange?: (skipped: boolean) => void;
  children: (props: {
    visibleHtml: string;
    visibleSpeakerHtml: string;
    isComplete: boolean;
    isAwaitingContinue: boolean;
    isRevealing: boolean;
    skip: () => void;
    resume: () => void;
    skipRevealChunk: () => void;
  }) => React.ReactNode;
};

export function shouldUsePromptExecutor(instructions: PromptInstruction[]): boolean {
  return promptInstructionsNeedExecutor(instructions);
}

export function PromptInstructionExecutor({
  fullHtml,
  initialSpeakerHtml = "",
  instructions,
  renderSpeakerTemplate,
  playbackGateRef,
  onPlaySound,
  onComplete,
  onSkipChange,
  children,
}: PromptInstructionExecutorProps) {
  const [visibleHtml, setVisibleHtml] = useState("");
  const [visibleSpeakerHtml, setVisibleSpeakerHtml] = useState(initialSpeakerHtml);
  const [isComplete, setIsComplete] = useState(false);
  const [isAwaitingContinue, setIsAwaitingContinue] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const isCompleteRef = useRef(false);
  const visibleHtmlLengthRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const checkpointRef = useRef<PromptExecutionCheckpoint | null>(null);
  const continueResolverRef = useRef<(() => void) | null>(null);
  const skipRevealChunkRequestedRef = useRef(false);
  const skipLatchActiveRef = useRef(false);
  const skipRevealChunkControlRef = useRef<RevealSkipControl>({
    consumeSkipRequest: () => {
      if (skipLatchActiveRef.current) return true;
      if (!skipRevealChunkRequestedRef.current) return false;
      skipRevealChunkRequestedRef.current = false;
      skipLatchActiveRef.current = true;
      return true;
    },
  });
  const onCompleteRef = useRef(onComplete);
  const onPlaySoundRef = useRef(onPlaySound);
  const onSkipChangeRef = useRef(onSkipChange);
  const renderSpeakerTemplateRef = useRef(renderSpeakerTemplate);
  onCompleteRef.current = onComplete;
  onPlaySoundRef.current = onPlaySound;
  onSkipChangeRef.current = onSkipChange;
  renderSpeakerTemplateRef.current = renderSpeakerTemplate;
  const instructionsKey = JSON.stringify(instructions);
  const initialSpeakerKey = initialSpeakerHtml;

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
    skipLatchActiveRef.current = false;
    continueResolverRef.current?.();
  }, []);

  const skipRevealChunk = useCallback(() => {
    if (isCompleteRef.current) return;
    skipRevealChunkRequestedRef.current = true;
  }, []);

  const handleRevealActiveChange = useCallback((active: boolean) => {
    setIsRevealing(active);
  }, []);

  const skip = useCallback(() => {
    abortRef.current?.abort();
    continueResolverRef.current?.();
    setVisibleHtml(fullHtml);
    const renderSpeaker = renderSpeakerTemplateRef.current;
    if (renderSpeaker) {
      void renderFinalSpeakerHtml(instructions, initialSpeakerHtml, renderSpeaker).then(
        setVisibleSpeakerHtml
      );
    }
    skipLatchActiveRef.current = false;
    isCompleteRef.current = true;
    setIsComplete(true);
    setIsAwaitingContinue(false);
    onSkipChangeRef.current?.(true);
    runSounds(instructions.filter((instruction) => instruction.kind === "playSound"));
    onCompleteRef.current?.();
  }, [fullHtml, initialSpeakerHtml, instructions, runSounds]);

  useEffect(() => {
    abortRef.current?.abort();
    continueResolverRef.current?.();
    const controller = new AbortController();
    abortRef.current = controller;
    checkpointRef.current = null;
    isCompleteRef.current = false;
    setIsComplete(false);
    setIsAwaitingContinue(false);
    visibleHtmlLengthRef.current = 0;
    setIsRevealing(false);
    setVisibleSpeakerHtml(initialSpeakerHtml);
    skipRevealChunkRequestedRef.current = false;
    skipLatchActiveRef.current = false;
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

    const renderSpeaker = renderSpeakerTemplateRef.current;
    void executePromptInstructions({
      instructions,
      checkpoint: checkpointRef.current ?? undefined,
      onCheckpoint: (checkpoint) => {
        checkpointRef.current = checkpoint;
      },
      signal: controller.signal,
      onHtmlUpdate: (html) => {
        visibleHtmlLengthRef.current = html.length;
        setVisibleHtml(html);
      },
      onSpeakerUpdate: renderSpeaker ? setVisibleSpeakerHtml : undefined,
      renderSpeakerTemplate: renderSpeaker,
      onPlaySound: (assetId, options) => {
        onPlaySoundRef.current?.(assetId, options);
      },
      shouldPause: () => {
        const gate = playbackGateRef?.current;
        if (!gate?.shouldPausePlayback) return false;
        return gate.measuredForHtmlLength >= visibleHtmlLengthRef.current;
      },
      waitForContinue,
      skipRevealChunk: skipRevealChunkControlRef.current,
      onRevealActiveChange: handleRevealActiveChange,
    })
      .then(() => {
        if (!controller.signal.aborted) {
          setVisibleHtml(fullHtml);
          isCompleteRef.current = true;
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
  }, [fullHtml, initialSpeakerKey, instructionsKey, waitForContinue, handleRevealActiveChange]);

  return (
    <>
      {children({
        visibleHtml,
        visibleSpeakerHtml,
        isComplete,
        isAwaitingContinue,
        isRevealing,
        skip,
        resume,
        skipRevealChunk,
      })}
    </>
  );
}
