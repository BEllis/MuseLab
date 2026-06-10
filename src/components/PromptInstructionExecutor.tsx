import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptInstruction } from "@/core/prompt/promptInstructions";
import { promptInstructionsNeedExecutor } from "@/core/prompt/promptInstructions";
import { executePromptInstructions } from "@/core/prompt/executePromptInstructions";

export type PromptInstructionExecutorProps = {
  fullHtml: string;
  instructions: PromptInstruction[];
  onPlaySound?: (assetId: string, options?: { startTime?: number; endTime?: number }) => void;
  onComplete?: () => void;
  onSkipChange?: (skipped: boolean) => void;
  children: (props: {
    visibleHtml: string;
    isComplete: boolean;
    skip: () => void;
  }) => React.ReactNode;
};

export function shouldUsePromptExecutor(instructions: PromptInstruction[]): boolean {
  return promptInstructionsNeedExecutor(instructions);
}

export function PromptInstructionExecutor({
  fullHtml,
  instructions,
  onPlaySound,
  onComplete,
  onSkipChange,
  children,
}: PromptInstructionExecutorProps) {
  const [visibleHtml, setVisibleHtml] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const playedSoundsRef = useRef<Set<number>>(new Set());
  const onCompleteRef = useRef(onComplete);
  const onPlaySoundRef = useRef(onPlaySound);
  onCompleteRef.current = onComplete;
  onPlaySoundRef.current = onPlaySound;

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

  const skip = useCallback(() => {
    abortRef.current?.abort();
    setVisibleHtml(fullHtml);
    setIsComplete(true);
    onSkipChange?.(true);
    runSounds(instructions.filter((instruction) => instruction.kind === "playSound"));
    onCompleteRef.current?.();
  }, [fullHtml, instructions, onSkipChange, runSounds]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    playedSoundsRef.current = new Set();
    setIsComplete(false);
    onSkipChange?.(false);

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
      signal: controller.signal,
      onHtmlUpdate: setVisibleHtml,
      onPlaySound: (assetId, options) => {
        onPlaySoundRef.current?.(assetId, options);
      },
    })
      .then(() => {
        if (!controller.signal.aborted) {
          setVisibleHtml(fullHtml);
          setIsComplete(true);
          onCompleteRef.current?.();
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      });

    return () => {
      controller.abort();
    };
  }, [fullHtml, instructions, onSkipChange]);

  return <>{children({ visibleHtml, isComplete, skip })}</>;
}
