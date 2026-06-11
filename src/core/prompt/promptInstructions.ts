export const DEFAULT_CHARS_PER_SECOND = 40;
export const DEFAULT_WORDS_PER_SECOND = 12;

export type RevealRateMode =
  | { kind: "charsPerSecond"; rate: number }
  | { kind: "wordsPerSecond"; rate: number };

export type RevealOverTimeMode =
  | { kind: "charsOverTime"; durationMs: number }
  | { kind: "wordsOverTime"; durationMs: number };

export type RevealMode = RevealRateMode | RevealOverTimeMode;

export type PromptInstruction =
  | { kind: "appendHtml"; html: string }
  | { kind: "revealHtml"; html: string; plainLength: number; wordCount: number; mode: RevealMode }
  | { kind: "wait"; milliseconds: number }
  | { kind: "waitForContinue" }
  | {
      kind: "playSound";
      assetId: string;
      delaySeconds: number;
      startTime?: number;
      endTime?: number;
    }
  | { kind: "updateSpeaker"; template: string }
  | { kind: "reset" }
  | { kind: "clear" };

type OverTimeItem =
  | { kind: "text"; html: string; plainLength: number; wordCount: number }
  | {
      kind: "sound";
      assetId: string;
      delaySeconds: number;
      startTime?: number;
      endTime?: number;
    }
  | { kind: "wait"; milliseconds: number }
  | { kind: "updateSpeaker"; template: string };

type RevealBlockState =
  | { kind: "none" }
  | { kind: "rate"; mode: RevealRateMode }
  | {
      kind: "overTime";
      mode: RevealOverTimeMode;
      items: OverTimeItem[];
    };

export type PromptInstructionRecorder = {
  instructions: PromptInstruction[];
  appendHtml(html: string): void;
  appendRevealText(html: string, plainText: string): void;
  wait(milliseconds: number): void;
  waitForContinue(): void;
  revealCharsBegin(charsPerSecond: number): void;
  revealWordsBegin(wordsPerSecond: number): void;
  revealCharsOverTimeBegin(durationMs: number): void;
  revealWordsOverTimeBegin(durationMs: number): void;
  revealEnd(): void;
  playSound(
    assetId: string,
    delaySeconds: number,
    startTime: number,
    endTime: number
  ): void;
  updateSpeaker(template: string): void;
  reset(): void;
  clear(): void;
};

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function normalizeRate(rate: number, defaultRate: number): number {
  if (rate < 0) return defaultRate;
  if (rate === 0) return defaultRate;
  return rate;
}

function appendOverTimeText(
  state: RevealBlockState & { kind: "overTime" },
  html: string,
  plainText: string
): void {
  const last = state.items[state.items.length - 1];
  if (last?.kind === "text") {
    last.html += html;
    last.plainLength += plainText.length;
    last.wordCount += countWords(plainText);
    return;
  }
  state.items.push({
    kind: "text",
    html,
    plainLength: plainText.length,
    wordCount: countWords(plainText),
  });
}

function flushOverTimeItems(
  state: RevealBlockState & { kind: "overTime" },
  instructions: PromptInstruction[]
): void {
  const textItems = state.items.filter(
    (item): item is Extract<OverTimeItem, { kind: "text" }> => item.kind === "text"
  );
  const totalPlain = textItems.reduce((sum, item) => sum + item.plainLength, 0);
  const totalWords = textItems.reduce((sum, item) => sum + item.wordCount, 0);

  for (const item of state.items) {
    if (item.kind === "text") {
      const share =
        state.mode.kind === "wordsOverTime"
          ? totalWords > 0
            ? item.wordCount / totalWords
            : 1
          : totalPlain > 0
            ? item.plainLength / totalPlain
            : 1;
      instructions.push({
        kind: "revealHtml",
        html: item.html,
        plainLength: item.plainLength,
        wordCount: item.wordCount,
        mode:
          state.mode.kind === "wordsOverTime"
            ? { kind: "wordsOverTime", durationMs: Math.round(state.mode.durationMs * share) }
            : { kind: "charsOverTime", durationMs: Math.round(state.mode.durationMs * share) },
      });
      continue;
    }
    if (item.kind === "wait") {
      instructions.push({ kind: "wait", milliseconds: item.milliseconds });
      continue;
    }
    if (item.kind === "updateSpeaker") {
      instructions.push({ kind: "updateSpeaker", template: item.template });
      continue;
    }
    const sound: PromptInstruction = {
      kind: "playSound",
      assetId: item.assetId,
      delaySeconds: item.delaySeconds,
    };
    if (item.startTime !== undefined) sound.startTime = item.startTime;
    if (item.endTime !== undefined) sound.endTime = item.endTime;
    instructions.push(sound);
  }
  state.items = [];
}

function endActiveRevealBlock(
  block: RevealBlockState,
  instructions: PromptInstruction[]
): RevealBlockState {
  if (block.kind === "overTime") {
    flushOverTimeItems(block, instructions);
  }
  return { kind: "none" };
}

export function createPromptInstructionRecorder(): PromptInstructionRecorder {
  const instructions: PromptInstruction[] = [];
  let block: RevealBlockState = { kind: "none" };

  const pushHtml = (html: string, plainText: string): void => {
    if (!html) return;
    if (block.kind === "none") {
      instructions.push({ kind: "appendHtml", html });
      return;
    }
    if (block.kind === "rate") {
      instructions.push({
        kind: "revealHtml",
        html,
        plainLength: plainText.length,
        wordCount: countWords(plainText),
        mode: block.mode,
      });
      return;
    }
    appendOverTimeText(block, html, plainText);
  };

  return {
    instructions,
    appendHtml(html: string) {
      pushHtml(html, "");
    },
    appendRevealText(html: string, plainText: string) {
      pushHtml(html, plainText);
    },
    wait(milliseconds: number) {
      if (milliseconds <= 0) return;
      const ms = Math.trunc(milliseconds);
      if (block.kind === "overTime") {
        block.items.push({ kind: "wait", milliseconds: ms });
        return;
      }
      instructions.push({ kind: "wait", milliseconds: ms });
    },
    waitForContinue() {
      if (block.kind === "overTime") {
        flushOverTimeItems(block, instructions);
        block = { kind: "none" };
      }
      instructions.push({ kind: "waitForContinue" });
    },
    revealCharsBegin(charsPerSecond: number) {
      if (block.kind === "overTime") {
        flushOverTimeItems(block, instructions);
      }
      block = {
        kind: "rate",
        mode: {
          kind: "charsPerSecond",
          rate: normalizeRate(charsPerSecond, DEFAULT_CHARS_PER_SECOND),
        },
      };
    },
    revealWordsBegin(wordsPerSecond: number) {
      if (block.kind === "overTime") {
        flushOverTimeItems(block, instructions);
      }
      block = {
        kind: "rate",
        mode: {
          kind: "wordsPerSecond",
          rate: normalizeRate(wordsPerSecond, DEFAULT_WORDS_PER_SECOND),
        },
      };
    },
    revealCharsOverTimeBegin(durationMs: number) {
      if (block.kind === "overTime") {
        flushOverTimeItems(block, instructions);
      }
      block = {
        kind: "overTime",
        mode: { kind: "charsOverTime", durationMs: Math.max(0, Math.trunc(durationMs)) },
        items: [],
      };
    },
    revealWordsOverTimeBegin(durationMs: number) {
      if (block.kind === "overTime") {
        flushOverTimeItems(block, instructions);
      }
      block = {
        kind: "overTime",
        mode: { kind: "wordsOverTime", durationMs: Math.max(0, Math.trunc(durationMs)) },
        items: [],
      };
    },
    revealEnd() {
      block = endActiveRevealBlock(block, instructions);
    },
    playSound(assetId: string, delaySeconds: number, startTime: number, endTime: number) {
      const sound: OverTimeItem = {
        kind: "sound",
        assetId,
        delaySeconds: Math.max(0, delaySeconds),
      };
      if (startTime >= 0) sound.startTime = startTime;
      if (endTime >= 0) sound.endTime = endTime;
      if (block.kind === "overTime") {
        block.items.push(sound);
        return;
      }
      const instruction: PromptInstruction = {
        kind: "playSound",
        assetId,
        delaySeconds: sound.delaySeconds,
      };
      if (sound.startTime !== undefined) instruction.startTime = sound.startTime;
      if (sound.endTime !== undefined) instruction.endTime = sound.endTime;
      instructions.push(instruction);
    },
    updateSpeaker(template: string) {
      if (block.kind === "overTime") {
        block.items.push({ kind: "updateSpeaker", template });
        return;
      }
      instructions.push({ kind: "updateSpeaker", template });
    },
    reset() {
      block = endActiveRevealBlock(block, instructions);
      instructions.push({ kind: "reset" });
    },
    clear() {
      block = endActiveRevealBlock(block, instructions);
      instructions.push({ kind: "clear" });
    },
  };
}

export function promptInstructionsNeedExecutor(instructions: PromptInstruction[]): boolean {
  return instructions.some(
    (instruction) =>
      instruction.kind === "appendHtml" ||
      instruction.kind === "wait" ||
      instruction.kind === "waitForContinue" ||
      instruction.kind === "revealHtml" ||
      instruction.kind === "playSound" ||
      instruction.kind === "updateSpeaker" ||
      instruction.kind === "reset" ||
      instruction.kind === "clear"
  );
}
