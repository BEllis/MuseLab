import { scanIfBody, scanIfCondition, skipWhitespace } from "./museLabRazorScan";

export function extractOutputExpr(text: string): string {
  return text.slice(1);
}

export function extractOutputExprParen(text: string): string {
  const inner = text.slice(2);
  if (inner.endsWith(")")) {
    return inner.slice(0, -1);
  }
  return inner;
}

export function extractCodeBlockBody(text: string): string {
  return text.slice(2, text.length - 1);
}

export function extractIfParts(block: string): { condition: string; body: string } {
  let i = skipWhitespace(block, 3);
  if (block[i] !== "(") {
    throw new Error("Expected '(' after @if");
  }
  const condEnd = scanIfCondition(block, i);
  const condition = block.slice(i + 1, condEnd - 1);
  i = skipWhitespace(block, condEnd);
  if (block[i] !== "{") {
    throw new Error("Expected '{' after @if condition");
  }
  const bodyEnd = scanIfBody(block, i);
  const body = block.slice(i + 1, bodyEnd - 1);
  return { condition, body };
}

export { splitStatements } from "./museLabRazorScan";
