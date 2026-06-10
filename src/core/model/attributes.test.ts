import { describe, expect, it } from "vitest";
import {
  normalizeAttributes,
  normalizeOptionalAttributes,
  removeAttributeKey,
  setAttributesAtPath,
  validateAttributeValue,
  validateAttributes,
} from "./attributes";

describe("attributes", () => {
  it("validates tagged attribute values", () => {
    expect(validateAttributeValue({ type: "string", value: "hello" })).toEqual({
      type: "string",
      value: "hello",
    });
    expect(validateAttributeValue({ type: "integer", value: 3 })).toEqual({
      type: "integer",
      value: 3,
    });
    expect(validateAttributeValue({ type: "number", value: 1.5 })).toEqual({
      type: "number",
      value: 1.5,
    });
  });

  it("validates nested object and list values", () => {
    const attrs = validateAttributes({
      border: {
        type: "object",
        value: {
          width: { type: "integer", value: 2 },
          color: { type: "string", value: "#fff" },
        },
      },
      tags: {
        type: "list",
        value: [
          { type: "string", value: "a" },
          { type: "integer", value: 1 },
        ],
      },
    });

    expect(attrs.border.type).toBe("object");
    expect(attrs.tags.type).toBe("list");
  });

  it("rejects invalid attribute payloads", () => {
    expect(() => validateAttributeValue({ type: "integer", value: 1.5 })).toThrow();
    expect(() => validateAttributeValue({ type: "unknown", value: 1 })).toThrow();
  });

  it("normalizes empty attribute maps to undefined", () => {
    expect(normalizeAttributes({})).toBeUndefined();
    expect(normalizeAttributes(undefined)).toBeUndefined();
  });

  it("updates and removes keys by path", () => {
    const initial = {
      border: {
        type: "object" as const,
        value: {
          width: { type: "integer" as const, value: 1 },
        },
      },
    };

    const updated = setAttributesAtPath(initial, ["border", "width"], {
      type: "integer",
      value: 4,
    });
    const border = updated?.border;
    expect(border?.type).toBe("object");
    if (border?.type === "object") {
      expect(border.value.width).toEqual({ type: "integer", value: 4 });
    }

    const removed = removeAttributeKey(updated!, "border");
    expect(removed).toBeUndefined();
  });

  it("normalizes optional attributes on load", () => {
    expect(
      normalizeOptionalAttributes(
        {
          color: { type: "string", value: "red" },
        },
        "attributes"
      )
    ).toEqual({
      color: { type: "string", value: "red" },
    });
  });
});
