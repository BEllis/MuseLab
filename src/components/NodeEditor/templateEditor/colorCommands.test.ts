import { describe, expect, it } from "vitest";
import { findColorStartForSelection, formatColorStartSnippet } from "./colorCommands";

describe("findColorStartForSelection", () => {
  it("finds ColorStart when cursor is on the tag", () => {
    const doc = 'Hi @Format.ColorStart("#ff0000")there';
    const tag = '@Format.ColorStart("#ff0000")';
    const from = doc.indexOf(tag);
    expect(findColorStartForSelection(doc, from + 2, from + 4)).toEqual({
      from,
      to: from + tag.length,
    });
  });

  it("finds ColorStart when cursor is immediately after the tag", () => {
    const doc = '@Format.ColorStart("#00ff00")text';
    const tag = '@Format.ColorStart("#00ff00")';
    const from = doc.indexOf(tag);
    const cursor = from + tag.length;
    expect(findColorStartForSelection(doc, cursor, cursor)).toEqual({
      from,
      to: cursor,
    });
  });

  it("finds ColorStart already wrapping the selection", () => {
    const doc = '@Format.ColorStart("#000000")word@Format.ColorEnd()';
    const tag = '@Format.ColorStart("#000000")';
    const from = doc.indexOf(tag);
    const selFrom = from + tag.length;
    const selTo = selFrom + 4;
    expect(findColorStartForSelection(doc, selFrom, selTo)).toEqual({
      from,
      to: from + tag.length,
    });
  });

  it("finds ColorStart directly before a non-empty selection", () => {
    const doc = '@Format.ColorStart("#111111")hello';
    const tag = '@Format.ColorStart("#111111")';
    const from = doc.indexOf(tag);
    const selFrom = from + tag.length;
    expect(findColorStartForSelection(doc, selFrom, selFrom + 5)).toEqual({
      from,
      to: from + tag.length,
    });
  });

  it("returns null when no color command is at the position", () => {
    const doc = "plain text";
    expect(findColorStartForSelection(doc, 3, 3)).toBeNull();
  });
});

describe("formatColorStartSnippet", () => {
  it("builds a ColorStart expression", () => {
    expect(formatColorStartSnippet("#abc123")).toBe('@Format.ColorStart("#abc123")');
  });
});
