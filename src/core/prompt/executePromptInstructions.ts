import type { PromptInstruction, RevealMode } from "./promptInstructions";
import {
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

export type ExecutePromptInstructionsOptions = {
  instructions: PromptInstruction[];
  checkpoint?: PromptExecutionCheckpoint;
  onCheckpoint?: (checkpoint: PromptExecutionCheckpoint) => void;
  onHtmlUpdate: (html: string) => void;
  onPlaySound: PlaySoundCallback;
  shouldPause?: () => boolean;
  waitForContinue?: () => Promise<void>;
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
  waitForContinue: (() => Promise<void>) | undefined
): Promise<void> {
  if (!shouldPause || !waitForContinue) return;
  await waitForLayout();
  if (!shouldPause()) return;
  await waitForContinue();
}

async function revealHtml(
  baseHtml: string,
  instruction: Extract<PromptInstruction, { kind: "revealHtml" }>,
  onHtmlUpdate: (html: string) => void,
  options: {
    startStep?: number;
    shouldPause?: () => boolean;
    waitForContinue?: () => Promise<void>;
    signal?: AbortSignal;
  }
): Promise<RevealProgress> {
  const { html, plainLength, wordCount, mode } = instruction;
  const nextHtml = baseHtml + html;
  const startStep = options.startStep ?? 0;
  let visibleHtml = baseHtml;
  let revealStep = startStep;

  const applyStep = (step: number, partialHtml: string) => {
    visibleHtml = baseHtml + partialHtml;
    revealStep = step;
    onHtmlUpdate(visibleHtml);
  };

  if (mode.kind === "charsOverTime") {
    const steps = Math.max(plainLength, 1);
    const delay = mode.durationMs / steps;
    for (let step = Math.max(startStep + 1, 1); step <= steps; step += 1) {
      applyStep(step, htmlPrefixForPlainLength(html, step));
      await maybePause(options.shouldPause, options.waitForContinue);
      if (step < steps) await sleep(delay, options.signal);
    }
    applyStep(steps, html);
    return { visibleHtml: nextHtml, revealStep: steps };
  }

  if (mode.kind === "wordsOverTime") {
    const steps = Math.max(wordCount, 1);
    const delay = mode.durationMs / steps;
    for (let step = Math.max(startStep + 1, 1); step <= steps; step += 1) {
      applyStep(step, htmlPrefixForWordCount(html, step));
      await maybePause(options.shouldPause, options.waitForContinue);
      if (step < steps) await sleep(delay, options.signal);
    }
    applyStep(steps, html);
    return { visibleHtml: nextHtml, revealStep: steps };
  }

  if (mode.kind === "charsPerSecond") {
    for (let step = Math.max(startStep + 1, 1); step <= plainLength; step += 1) {
      applyStep(step, htmlPrefixForPlainLength(html, step));
      await maybePause(options.shouldPause, options.waitForContinue);
      if (step < plainLength) {
        await sleep(revealStepDelayMs(mode, 1), options.signal);
      }
    }
    onHtmlUpdate(nextHtml);
    return { visibleHtml: nextHtml, revealStep: plainLength };
  }

  for (let step = Math.max(startStep + 1, 1); step <= wordCount; step += 1) {
    applyStep(step, htmlPrefixForWordCount(html, step));
    await maybePause(options.shouldPause, options.waitForContinue);
    if (step < wordCount) {
      await sleep(revealStepDelayMs(mode, 1), options.signal);
    }
  }
  onHtmlUpdate(nextHtml);
  return { visibleHtml: nextHtml, revealStep: wordCount };
}

export async function executePromptInstructions(
  options: ExecutePromptInstructionsOptions
): Promise<void> {
  const {
    instructions,
    checkpoint,
    onCheckpoint,
    onHtmlUpdate,
    onPlaySound,
    shouldPause,
    waitForContinue,
    signal,
  } = options;

  let instructionIndex = checkpoint?.instructionIndex ?? 0;
  let visibleHtml = checkpoint?.visibleHtml ?? "";
  let activeRevealStep = checkpoint?.revealStep;

  const saveCheckpoint = (
    nextInstructionIndex: number,
    nextVisibleHtml: string,
    nextRevealStep?: number
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
      visibleHtml += instruction.html;
      onHtmlUpdate(visibleHtml);
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
      const progress = await revealHtml(visibleHtml, instruction, onHtmlUpdate, {
        startStep: activeRevealStep,
        shouldPause,
        waitForContinue,
        signal,
      });
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
        Object.keys(trim).length > 0 ? trim : undefined
      );
      instructionIndex += 1;
      activeRevealStep = undefined;
      saveCheckpoint(instructionIndex, visibleHtml, undefined);
    }
  }
}

export function collectRemainingPlaySounds(
  instructions: PromptInstruction[],
  startIndex: number
): Extract<PromptInstruction, { kind: "playSound" }>[] {
  return instructions
    .slice(startIndex)
    .filter((instruction): instruction is Extract<PromptInstruction, { kind: "playSound" }> =>
      instruction.kind === "playSound"
    );
}

export function getDefaultRevealRate(mode: RevealMode): number {
  if (mode.kind === "charsPerSecond") return mode.rate || DEFAULT_CHARS_PER_SECOND;
  if (mode.kind === "wordsPerSecond") return mode.rate || DEFAULT_WORDS_PER_SECOND;
  return 0;
}
