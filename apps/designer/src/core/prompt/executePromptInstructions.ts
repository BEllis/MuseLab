import { DEFAULT_CONTINUATION_VISUAL_LINE_INTERVAL } from "@/core/view/dialogueLinePagination";
import type { PromptInstruction, RevealMode } from "./promptInstructions";
import {
  countWords,
  DEFAULT_CHARS_PER_SECOND,
  DEFAULT_WORDS_PER_SECOND,
} from "./promptInstructions";

export type PlaySoundCallback = (
  assetId: string,
  options?: { startTime?: number; endTime?: number }
) => void;

export type PromptExecutionCheckpoint = {
  instructionIndex: number;
  visibleHtml: string;
  revealStep?: number;
};

export type RevealSkipControl = {
  consumeSkipRequest: () => boolean;
};

export type ExecutePromptInstructionsOptions = {
  instructions: PromptInstruction[];
  checkpoint?: PromptExecutionCheckpoint;
  onCheckpoint?: (checkpoint: PromptExecutionCheckpoint) => void;
  onHtmlUpdate: (html: string) => void;
  initialSpeakerHtml?: string;
  onSpeakerUpdate?: (html: string) => void;
  renderSpeakerTemplate?: (template: string) => Promise<string>;
  onPlaySound: PlaySoundCallback;
  shouldPause?: () => boolean;
  waitForContinue?: () => Promise<void>;
  measureVisualLinesAtHtml?: (html: string) => number;
  getLinesAtLastContinue?: () => number;
  continuationVisualLineInterval?: number;
  skipRevealChunk?: RevealSkipControl;
  onRevealActiveChange?: (active: boolean) => void;
  signal?: AbortSignal;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function htmlPrefixForPlainLength(html: string, targetPlainLength: number): string {
  if (targetPlainLength <= 0) return "";
  let plainCount = 0;
  let index = 0;
  let output = "";

  while (index < html.length) {
    if (html[index] === "<") {
      const end = html.indexOf(">", index);
      if (end === -1) {
        output += html.slice(index);
        break;
      }
      output += html.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (html[index] === "&") {
      const end = html.indexOf(";", index);
      const entity = end === -1 ? html[index] : html.slice(index, end + 1);
      output += entity;
      plainCount += 1;
      index += entity.length;
    } else {
      output += html[index];
      plainCount += 1;
      index += 1;
    }
    if (plainCount >= targetPlainLength) break;
  }

  return output;
}

function plainTextFromHtml(html: string): string {
  let plain = "";
  let index = 0;
  while (index < html.length) {
    if (html[index] === "<") {
      const end = html.indexOf(">", index);
      index = end === -1 ? html.length : end + 1;
      continue;
    }
    if (html[index] === "&") {
      const end = html.indexOf(";", index);
      const entity = end === -1 ? html[index] : html.slice(index, end + 1);
      if (entity === "&lt;") plain += "<";
      else if (entity === "&gt;") plain += ">";
      else if (entity === "&amp;") plain += "&";
      else if (entity === "&quot;") plain += '"';
      else if (entity === "&nbsp;" || entity === "&#160;") plain += " ";
      else if (entity === "<br>") plain += "\n";
      else plain += entity;
      index += entity.length;
      continue;
    }
    if (html.startsWith("<br>", index)) {
      plain += "\n";
      index += 4;
      continue;
    }
    plain += html[index];
    index += 1;
  }
  return plain;
}

function wordBoundaryPlainLengths(plain: string): number[] {
  const boundaries: number[] = [];
  let inWord = false;
  for (let index = 0; index <= plain.length; index += 1) {
    const char = plain[index];
    const isBoundary = char === undefined || /\s/.test(char);
    if (!inWord && char !== undefined && !/\s/.test(char)) {
      inWord = true;
    }
    if (inWord && isBoundary) {
      boundaries.push(index);
      inWord = false;
    }
  }
  return boundaries;
}

export function htmlPrefixForWordCount(html: string, targetWords: number): string {
  if (targetWords <= 0) return "";
  const plain = plainTextFromHtml(html);
  const boundaries = wordBoundaryPlainLengths(plain);
  if (boundaries.length === 0) return "";
  const plainLength = boundaries[Math.min(targetWords, boundaries.length) - 1];
  return htmlPrefixForPlainLength(html, plainLength);
}

function revealStepDelayMs(mode: RevealMode, units: number): number {
  if (units <= 0) return 0;
  if (mode.kind === "charsPerSecond") {
    return (1000 * units) / mode.rate;
  }
  if (mode.kind === "wordsPerSecond") {
    return (1000 * units) / mode.rate;
  }
  return 0;
}

type RevealProgress = {
  visibleHtml: string;
  revealStep: number;
};

async function waitForLayout(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function maybePause(
  shouldPause: (() => boolean) | undefined,
  waitForContinue: (() => Promise<void>) | undefined,
): Promise<void> {
  if (!shouldPause || !waitForContinue) return;
  await waitForLayout();
  if (!shouldPause()) return;
  await waitForContinue();
}

function consumeSkipRequest(skipRevealChunk: RevealSkipControl | undefined): boolean {
  return skipRevealChunk?.consumeSkipRequest() ?? false;
}

async function interruptibleDelay(
  ms: number,
  signal: AbortSignal | undefined,
  shouldInterrupt: () => boolean,
): Promise<void> {
  if (ms <= 0) return;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (shouldInterrupt()) return;
    await sleep(Math.min(16, end - Date.now()), signal);
  }
}

async function fastForwardRevealSteps(
  step: number,
  maxStep: number,
  applyStep: (nextStep: number, partialHtml: string) => void,
  getPartialHtml: (nextStep: number) => string,
): Promise<number> {
  let nextStep = step;
  while (nextStep < maxStep) {
    nextStep += 1;
    applyStep(nextStep, getPartialHtml(nextStep));
    await waitForLayout();
  }
  return nextStep;
}

type RevealStepRunnerOptions = {
  startStep: number;
  maxStep: number;
  getPartialHtml: (step: number) => string;
  applyStep: (step: number, partialHtml: string) => void;
  delayAfterStep?: (step: number) => number;
  shouldPause?: () => boolean;
  waitForContinue?: () => Promise<void>;
  skipRevealChunk?: RevealSkipControl;
  signal?: AbortSignal;
  startSkipped?: boolean;
};

async function runRevealSteps(options: RevealStepRunnerOptions): Promise<number> {
  const {
    maxStep,
    getPartialHtml,
    applyStep,
    delayAfterStep,
    shouldPause,
    waitForContinue,
    skipRevealChunk,
    signal,
  } = options;
  let step = options.startStep;
  let skipBurstActive = options.startSkipped ?? false;

  const requestSkipBurst = () => {
    if (skipBurstActive) return true;
    if (consumeSkipRequest(skipRevealChunk)) {
      skipBurstActive = true;
      return true;
    }
    return false;
  };

  const runSkipBurst = async (fromStep: number) => {
    skipBurstActive = true;
    const nextStep = await fastForwardRevealSteps(
      fromStep,
      maxStep,
      applyStep,
      getPartialHtml,
    );
    skipBurstActive = false;
    return nextStep;
  };

  while (step < maxStep) {
    if (requestSkipBurst()) {
      step = await runSkipBurst(step);
      await maybePause(shouldPause, waitForContinue);
      continue;
    }

    step += 1;
    applyStep(step, getPartialHtml(step));
    await maybePause(shouldPause, waitForContinue);

    if (requestSkipBurst()) {
      step = await runSkipBurst(step);
      await maybePause(shouldPause, waitForContinue);
      continue;
    }

    if (step < maxStep) {
      const delay = delayAfterStep?.(step) ?? 0;
      if (delay > 0) {
        await interruptibleDelay(delay, signal, requestSkipBurst);
        if (requestSkipBurst()) {
          step = await runSkipBurst(step);
          await maybePause(shouldPause, waitForContinue);
        }
      }
    }
  }

  return step;
}

type InstantWordRevealOptions = {
  baseHtml: string;
  html: string;
  wordCount: number;
  startStep: number;
  getPartialHtml: (step: number) => string;
  onHtmlUpdate: (fullHtml: string) => void;
  measureVisualLinesAtHtml?: (html: string) => number;
  getLinesAtLastContinue?: () => number;
  continuationVisualLineInterval?: number;
  shouldPause?: () => boolean;
  waitForContinue?: () => Promise<void>;
  skipRevealChunk?: RevealSkipControl;
  signal?: AbortSignal;
};

async function runInstantWordReveal(options: InstantWordRevealOptions): Promise<number> {
  const {
    baseHtml,
    html: _html,
    wordCount,
    startStep,
    getPartialHtml,
    onHtmlUpdate,
    measureVisualLinesAtHtml,
    getLinesAtLastContinue,
    continuationVisualLineInterval = DEFAULT_CONTINUATION_VISUAL_LINE_INTERVAL,
    shouldPause,
    waitForContinue,
    skipRevealChunk,
    signal,
  } = options;

  const maxStep = Math.max(wordCount, 1);
  let step = startStep;

  const applyStep = (nextStep: number) => {
    onHtmlUpdate(baseHtml + getPartialHtml(nextStep));
  };

  const shouldPauseAtFullHtml = (fullHtml: string): boolean => {
    if (!measureVisualLinesAtHtml || !getLinesAtLastContinue) return false;
    const linesSince =
      measureVisualLinesAtHtml(fullHtml) - getLinesAtLastContinue();
    return linesSince >= continuationVisualLineInterval;
  };

  if (consumeSkipRequest(skipRevealChunk)) {
    applyStep(maxStep);
    return maxStep;
  }

  if (!measureVisualLinesAtHtml || !getLinesAtLastContinue) {
    if (step < maxStep) {
      applyStep(maxStep);
      await maybePause(shouldPause, waitForContinue);
    }
    return maxStep;
  }

  while (step < maxStep) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (consumeSkipRequest(skipRevealChunk)) {
      applyStep(maxStep);
      return maxStep;
    }

    if (!shouldPauseAtFullHtml(baseHtml + getPartialHtml(maxStep))) {
      applyStep(maxStep);
      return maxStep;
    }

    let lo = step + 1;
    let hi = maxStep;
    let pauseStep = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = baseHtml + getPartialHtml(mid);
      if (shouldPauseAtFullHtml(candidate)) {
        pauseStep = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    if (pauseStep === -1) {
      applyStep(maxStep);
      return maxStep;
    }

    applyStep(pauseStep);
    if (waitForContinue) {
      await waitForContinue();
    }
    step = pauseStep;
  }

  return step;
}

async function revealHtml(
  baseHtml: string,
  instruction: Extract<PromptInstruction, { kind: "revealHtml" }>,
  onHtmlUpdate: (html: string) => void,
  options: {
    startStep?: number;
    shouldPause?: () => boolean;
    waitForContinue?: () => Promise<void>;
    measureVisualLinesAtHtml?: (html: string) => number;
    getLinesAtLastContinue?: () => number;
    continuationVisualLineInterval?: number;
    skipRevealChunk?: RevealSkipControl;
    signal?: AbortSignal;
  },
): Promise<RevealProgress> {
  const { html, plainLength, wordCount, mode } = instruction;
  const nextHtml = baseHtml + html;
  const startStep = options.startStep ?? 0;
  let visibleHtml = baseHtml;

  const applyStep = (_step: number, partialHtml: string) => {
    visibleHtml = baseHtml + partialHtml;
    onHtmlUpdate(visibleHtml);
  };

  const startSkipped = consumeSkipRequest(options.skipRevealChunk);

  const runnerOptions = {
    startStep,
    shouldPause: options.shouldPause,
    waitForContinue: options.waitForContinue,
    skipRevealChunk: options.skipRevealChunk,
    signal: options.signal,
    applyStep,
    startSkipped,
  };

  if (mode.kind === "charsOverTime") {
    const maxStep = Math.max(plainLength, 1);
    const delay = mode.durationMs / maxStep;
    await runRevealSteps({
      ...runnerOptions,
      maxStep,
      getPartialHtml: (step) => htmlPrefixForPlainLength(html, step),
      delayAfterStep: () => delay,
    });
    applyStep(maxStep, html);
    return { visibleHtml: nextHtml, revealStep: maxStep };
  }

  if (mode.kind === "wordsOverTime") {
    const maxStep = Math.max(wordCount, 1);
    if (mode.durationMs === 0) {
      await runInstantWordReveal({
        baseHtml,
        html,
        wordCount,
        startStep,
        getPartialHtml: (step) => htmlPrefixForWordCount(html, step),
        onHtmlUpdate: (fullHtml) => {
          visibleHtml = fullHtml;
          onHtmlUpdate(fullHtml);
        },
        measureVisualLinesAtHtml: options.measureVisualLinesAtHtml,
        getLinesAtLastContinue: options.getLinesAtLastContinue,
        continuationVisualLineInterval: options.continuationVisualLineInterval,
        shouldPause: options.shouldPause,
        waitForContinue: options.waitForContinue,
        skipRevealChunk: options.skipRevealChunk,
        signal: options.signal,
      });
      return { visibleHtml: nextHtml, revealStep: maxStep };
    }
    const delay = mode.durationMs / maxStep;
    await runRevealSteps({
      ...runnerOptions,
      maxStep,
      getPartialHtml: (step) => htmlPrefixForWordCount(html, step),
      delayAfterStep: () => delay,
    });
    applyStep(maxStep, html);
    return { visibleHtml: nextHtml, revealStep: maxStep };
  }

  if (mode.kind === "charsPerSecond") {
    await runRevealSteps({
      ...runnerOptions,
      maxStep: plainLength,
      getPartialHtml: (step) => htmlPrefixForPlainLength(html, step),
      delayAfterStep: () => revealStepDelayMs(mode, 1),
    });
    onHtmlUpdate(nextHtml);
    return { visibleHtml: nextHtml, revealStep: plainLength };
  }

  await runRevealSteps({
    ...runnerOptions,
    maxStep: wordCount,
    getPartialHtml: (step) => htmlPrefixForWordCount(html, step),
    delayAfterStep: () => revealStepDelayMs(mode, 1),
  });
  onHtmlUpdate(nextHtml);
  return { visibleHtml: nextHtml, revealStep: wordCount };
}

function instantRevealInstruction(
  html: string,
): Extract<PromptInstruction, { kind: "revealHtml" }> {
  const plain = plainTextFromHtml(html);
  return {
    kind: "revealHtml",
    html,
    plainLength: plain.length,
    wordCount: countWords(plain),
    mode: { kind: "wordsOverTime", durationMs: 0 },
  };
}

export async function executePromptInstructions(
  options: ExecutePromptInstructionsOptions,
): Promise<void> {
  const {
    instructions,
    checkpoint,
    onCheckpoint,
    onHtmlUpdate,
    initialSpeakerHtml = "",
    onSpeakerUpdate,
    renderSpeakerTemplate,
    onPlaySound,
    shouldPause,
    waitForContinue,
    measureVisualLinesAtHtml,
    getLinesAtLastContinue,
    continuationVisualLineInterval,
    skipRevealChunk,
    onRevealActiveChange,
    signal,
  } = options;

  const revealMeasureOptions = {
    measureVisualLinesAtHtml,
    getLinesAtLastContinue,
    continuationVisualLineInterval,
  };

  let instructionIndex = checkpoint?.instructionIndex ?? 0;
  let visibleHtml = checkpoint?.visibleHtml ?? "";
  let activeRevealStep = checkpoint?.revealStep;

  const saveCheckpoint = (
    nextInstructionIndex: number,
    nextVisibleHtml: string,
    nextRevealStep?: number,
  ) => {
    onCheckpoint?.({
      instructionIndex: nextInstructionIndex,
      visibleHtml: nextVisibleHtml,
      revealStep: nextRevealStep,
    });
  };

  if (visibleHtml) {
    onHtmlUpdate(visibleHtml);
  }

  while (instructionIndex < instructions.length) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const instruction = instructions[instructionIndex];

    if (instruction.kind === "appendHtml") {
      const chunkHtml = instruction.html;
      const chunkPlain = plainTextFromHtml(chunkHtml);
      if (waitForContinue && chunkPlain.length > 0) {
        const progress = await revealHtml(
          visibleHtml,
          instantRevealInstruction(chunkHtml),
          onHtmlUpdate,
          { shouldPause, waitForContinue, skipRevealChunk, signal, ...revealMeasureOptions },
        );
        visibleHtml = progress.visibleHtml;
      } else {
        visibleHtml += chunkHtml;
        onHtmlUpdate(visibleHtml);
      }
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
      await maybePause(shouldPause, waitForContinue);
      continue;
    }

    if (instruction.kind === "wait") {
      await maybePause(shouldPause, waitForContinue);
      await sleep(instruction.milliseconds, signal);
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
      continue;
    }

    if (instruction.kind === "waitForContinue") {
      if (waitForContinue) {
        await waitForContinue();
      }
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
      continue;
    }

    if (instruction.kind === "revealHtml") {
      onRevealActiveChange?.(true);
      let progress: RevealProgress;
      try {
        progress = await revealHtml(visibleHtml, instruction, onHtmlUpdate, {
          startStep: activeRevealStep,
          shouldPause,
          waitForContinue,
          skipRevealChunk,
          signal,
          ...revealMeasureOptions,
        });
      } finally {
        onRevealActiveChange?.(false);
      }
      visibleHtml = progress.visibleHtml;
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
      await maybePause(shouldPause, waitForContinue);
      continue;
    }

    if (instruction.kind === "playSound") {
      await maybePause(shouldPause, waitForContinue);
      if (instruction.delaySeconds > 0) {
        await sleep(instruction.delaySeconds * 1000, signal);
      }
      const trim: { startTime?: number; endTime?: number } = {};
      if (instruction.startTime !== undefined) trim.startTime = instruction.startTime;
      if (instruction.endTime !== undefined) trim.endTime = instruction.endTime;
      onPlaySound(
        instruction.assetId,
        Object.keys(trim).length > 0 ? trim : undefined,
      );
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
      continue;
    }

    if (instruction.kind === "updateSpeaker") {
      await maybePause(shouldPause, waitForContinue);
      if (renderSpeakerTemplate && onSpeakerUpdate) {
        onSpeakerUpdate(await renderSpeakerTemplate(instruction.template));
      }
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
      continue;
    }

    if (instruction.kind === "reset") {
      await maybePause(shouldPause, waitForContinue);
      visibleHtml = "";
      onHtmlUpdate(visibleHtml);
      if (onSpeakerUpdate) {
        onSpeakerUpdate(initialSpeakerHtml);
      }
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
      continue;
    }

    if (instruction.kind === "clear") {
      await maybePause(shouldPause, waitForContinue);
      visibleHtml = "";
      onHtmlUpdate(visibleHtml);
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
    }
  }
}

export async function renderFinalSpeakerHtml(
  instructions: PromptInstruction[],
  initialSpeakerHtml: string,
  renderSpeakerTemplate: (template: string) => Promise<string>,
): Promise<string> {
  let speakerHtml = initialSpeakerHtml;
  for (const instruction of instructions) {
    if (instruction.kind !== "updateSpeaker") continue;
    speakerHtml = await renderSpeakerTemplate(instruction.template);
  }
  return speakerHtml;
}

export function collectRemainingPlaySounds(
  instructions: PromptInstruction[],
  startIndex: number,
): Extract<PromptInstruction, { kind: "playSound" }>[] {
  return instructions
    .slice(startIndex)
    .filter((instruction): instruction is Extract<PromptInstruction, { kind: "playSound" }> =>
      instruction.kind === "playSound",
    );
}

export function getDefaultRevealRate(mode: RevealMode): number {
  if (mode.kind === "charsPerSecond") return mode.rate || DEFAULT_CHARS_PER_SECOND;
  if (mode.kind === "wordsPerSecond") return mode.rate || DEFAULT_WORDS_PER_SECOND;
  return 0;
}
