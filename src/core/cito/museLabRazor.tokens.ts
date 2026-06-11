import { ExternalTokenizer } from "@lezer/lr";
import type { InputStream } from "@lezer/lr";
import {
  scanCitoExpression,
  scanCodeBlockBody,
  scanIfBody,
  scanIfCondition,
  scanTextUntilAt,
} from "./museLabRazorScan";
import {
  Text,
  EscapedAt,
  OutputExpr,
  OutputExprParen,
  CodeBlock,
  IfBlock,
} from "./museLabRazor.parser.terms";

function remainingSource(input: InputStream): string {
  let result = "";
  let offset = 0;
  for (;;) {
    const code = input.peek(offset);
    if (code < 0) break;
    result += String.fromCharCode(code);
    offset += 1;
  }
  return result;
}

function matchesKeyword(source: string, index: number, keyword: string): boolean {
  if (!source.startsWith(keyword, index)) return false;
  const next = source[index + keyword.length];
  return next === undefined || isBoundary(next);
}

function isBoundary(ch: string): boolean {
  return (
    ch === " " ||
    ch === "\t" ||
    ch === "\n" ||
    ch === "\r" ||
    ch === "(" ||
    ch === "{" ||
    ch === "@"
  );
}

function scanIfBlock(source: string, start: number): number {
  let i = start + 1 + "if".length;
  while (i < source.length && (source[i] === " " || source[i] === "\t" || source[i] === "\n" || source[i] === "\r")) {
    i += 1;
  }
  if (source[i] !== "(") return i;
  i = scanIfCondition(source, i);
  while (i < source.length && (source[i] === " " || source[i] === "\t" || source[i] === "\n" || source[i] === "\r")) {
    i += 1;
  }
  if (source[i] !== "{") return i;
  return scanIfBody(source, i);
}

export const templateTokens = new ExternalTokenizer((input) => {
  const source = remainingSource(input);
  const base = input.pos;
  const start = 0;

  if (source.length === 0) return;

  const ch = source[start]!;

  if (ch !== "@") {
    const end = scanTextUntilAt(source, start);
    if (end > start) {
      input.acceptTokenTo(Text, base + end);
    }
    return;
  }

  if (source[start + 1] === "@") {
    input.acceptTokenTo(EscapedAt, base + start + 2);
    return;
  }

  if (matchesKeyword(source, start + 1, "if")) {
    const end = scanIfBlock(source, start);
    input.acceptTokenTo(IfBlock, base + end);
    return;
  }

  if (source[start + 1] === "{") {
    const end = scanCodeBlockBody(source, start + 1);
    input.acceptTokenTo(CodeBlock, base + end);
    return;
  }

  if (source[start + 1] === "(") {
    const exprStart = start + 2;
    const end = scanCitoExpression(source, exprStart);
    if (source[end] === ")") {
      input.acceptTokenTo(OutputExprParen, base + end + 1);
    } else {
      input.acceptTokenTo(OutputExprParen, base + end);
    }
    return;
  }

  const exprStart = start + 1;
  const end = scanCitoExpression(source, exprStart);
  if (end > exprStart) {
    input.acceptTokenTo(OutputExpr, base + end);
  } else {
    input.acceptTokenTo(Text, base + start + 1);
  }
});
