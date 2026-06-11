/** Shared scanning helpers for MuseLab Razor templates. */

export function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

export function skipWhitespace(source: string, index: number): number {
  let i = index;
  while (i < source.length && isWhitespace(source[i]!)) i += 1;
  return i;
}

export function scanBalanced(
  source: string,
  start: number,
  open: string,
  close: string
): number {
  let depth = 0;
  let i = start;
  let inString = false;
  let escape = false;

  while (i < source.length) {
    const ch = source[i]!;

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      i += 1;
      continue;
    }

    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }

    i += 1;
  }

  return source.length;
}

function previousNonWhitespace(source: string, index: number): string | null {
  for (let i = index; i >= 0; i -= 1) {
    const ch = source[i]!;
    if (!isWhitespace(ch)) return ch;
  }
  return null;
}

/** Scan a Cito expression starting at `start` (first char after `@` or inside `@(`). */
export function scanCitoExpression(source: string, start: number): number {
  let i = start;
  let parenDepth = 0;
  let braceDepth = 0;
  let inString = false;
  let escape = false;

  while (i < source.length) {
    const ch = source[i]!;

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      i += 1;
      continue;
    }

    if (ch === "(") {
      parenDepth += 1;
      i += 1;
      continue;
    }

    if (ch === ")") {
      if (parenDepth === 0) return i;
      parenDepth -= 1;
      i += 1;
      continue;
    }

    if (ch === "{") {
      if (parenDepth === 0 && braceDepth === 0) return i;
      braceDepth += 1;
      i += 1;
      continue;
    }

    if (ch === "}") {
      if (parenDepth === 0 && braceDepth === 0) return i;
      if (braceDepth > 0) braceDepth -= 1;
      i += 1;
      continue;
    }

    if (parenDepth === 0 && braceDepth === 0) {
      if (ch === "@") return i;

      if (isWhitespace(ch)) return i;

      if (ch === "<" && (source[i + 1] === "/" || /[a-zA-Z]/.test(source[i + 1] ?? ""))) {
        return i;
      }

      if (ch === "!" && source[i - 1] !== "=" && source[i + 1] !== "=") {
        return i;
      }

      if (ch === "," || ch === "?") {
        return i;
      }

      if (/[a-zA-Z]/.test(ch)) {
        const prev = previousNonWhitespace(source, i - 1);
        if (prev === ")") return i;
      }
    }

    i += 1;
  }

  return i;
}

export function scanTextUntilAt(source: string, start: number): number {
  let i = start;
  while (i < source.length) {
    if (source[i] === "@") {
      return i;
    }
    i += 1;
  }
  return i;
}

export function scanCodeBlockBody(source: string, start: number): number {
  return scanBalanced(source, start, "{", "}");
}

export function scanIfCondition(source: string, start: number): number {
  return scanBalanced(source, start, "(", ")");
}

export function scanIfBody(source: string, start: number): number {
  return scanBalanced(source, start, "{", "}");
}

export function splitStatements(body: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  let parenDepth = 0;
  let braceDepth = 0;
  let inString = false;
  let escape = false;

  while (i <= body.length) {
    const ch = body[i];

    if (i === body.length || (ch === ";" && parenDepth === 0 && braceDepth === 0 && !inString)) {
      const piece = body.slice(start, i).trim();
      if (piece) statements.push(piece);
      start = i + 1;
      i += 1;
      continue;
    }

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      i += 1;
      continue;
    }

    if (ch === "(") parenDepth += 1;
    else if (ch === ")") parenDepth -= 1;
    else if (ch === "{") braceDepth += 1;
    else if (ch === "}") braceDepth -= 1;

    i += 1;
  }

  return statements;
}
