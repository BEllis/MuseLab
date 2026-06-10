export type AttributeValueType = "string" | "integer" | "number" | "object" | "list";

export type AttributeValue =
  | { type: "string"; value: string }
  | { type: "integer"; value: number }
  | { type: "number"; value: number }
  | { type: "object"; value: Record<string, AttributeValue> }
  | { type: "list"; value: AttributeValue[] };

export type Attributes = Record<string, AttributeValue>;

const ATTRIBUTE_VALUE_TYPES = new Set<AttributeValueType>([
  "string",
  "integer",
  "number",
  "object",
  "list",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAttributeValue(value: unknown, path = "attribute"): AttributeValue {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: expected an attribute value object`);
  }

  const type = value.type;
  if (typeof type !== "string" || !ATTRIBUTE_VALUE_TYPES.has(type as AttributeValueType)) {
    throw new Error(`${path}: invalid attribute type "${String(type)}"`);
  }

  if (!("value" in value)) {
    throw new Error(`${path}: missing value`);
  }

  switch (type) {
    case "string": {
      if (typeof value.value !== "string") {
        throw new Error(`${path}: string value must be a string`);
      }
      return { type: "string", value: value.value };
    }
    case "integer": {
      if (typeof value.value !== "number" || !Number.isInteger(value.value)) {
        throw new Error(`${path}: integer value must be an integer`);
      }
      return { type: "integer", value: value.value };
    }
    case "number": {
      if (typeof value.value !== "number" || Number.isNaN(value.value)) {
        throw new Error(`${path}: number value must be a number`);
      }
      return { type: "number", value: value.value };
    }
    case "object": {
      if (!isPlainObject(value.value)) {
        throw new Error(`${path}: object value must be an object`);
      }
      const objectValue: Record<string, AttributeValue> = {};
      for (const [key, entry] of Object.entries(value.value)) {
        if (typeof key !== "string" || key.length === 0) {
          throw new Error(`${path}.value: object keys must be non-empty strings`);
        }
        objectValue[key] = validateAttributeValue(entry, `${path}.value.${key}`);
      }
      return { type: "object", value: objectValue };
    }
    case "list": {
      if (!Array.isArray(value.value)) {
        throw new Error(`${path}: list value must be an array`);
      }
      const listValue = value.value.map((entry, index) =>
        validateAttributeValue(entry, `${path}.value[${index}]`)
      );
      return { type: "list", value: listValue };
    }
    default:
      throw new Error(`${path}: unsupported attribute type "${String(type)}"`);
  }
}

export function validateAttributes(value: unknown, path = "attributes"): Attributes {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: expected an object`);
  }
  const attrs: Attributes = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error(`${path}: keys must be non-empty strings`);
    }
    attrs[key] = validateAttributeValue(entry, `${path}.${key}`);
  }
  return attrs;
}

export function normalizeAttributes(attrs: Attributes | undefined | null): Attributes | undefined {
  if (!attrs) return undefined;
  const keys = Object.keys(attrs);
  if (keys.length === 0) return undefined;
  return attrs;
}

export function removeAttributeKey(attrs: Attributes, key: string): Attributes | undefined {
  if (!(key in attrs)) return normalizeAttributes(attrs);
  const next = { ...attrs };
  delete next[key];
  return normalizeAttributes(next);
}

export function setAttributesAtPath(
  attrs: Attributes | undefined,
  path: string[],
  value: AttributeValue | null
): Attributes | undefined {
  if (path.length === 0) {
    throw new Error("Attribute path must not be empty");
  }

  const [head, ...rest] = path;
  const base = { ...(attrs ?? {}) };

  if (rest.length === 0) {
    if (value === null) {
      return removeAttributeKey(base, head);
    }
    return normalizeAttributes({ ...base, [head]: value });
  }

  const existing = base[head];
  if (!existing || existing.type !== "object") {
    if (value === null) {
      return normalizeAttributes(base);
    }
    throw new Error(`Cannot set nested attribute at "${path.join(".")}": parent is not an object`);
  }

  const nested = setAttributesAtPath(existing.value, rest, value);
  if (!nested) {
    delete base[head];
    return normalizeAttributes(base);
  }

  return normalizeAttributes({
    ...base,
    [head]: { type: "object", value: nested },
  });
}

export function createDefaultAttributeValue(type: AttributeValueType): AttributeValue {
  switch (type) {
    case "string":
      return { type: "string", value: "" };
    case "integer":
      return { type: "integer", value: 0 };
    case "number":
      return { type: "number", value: 0 };
    case "object":
      return { type: "object", value: {} };
    case "list":
      return { type: "list", value: [] };
    default: {
      const exhaustive: never = type;
      throw new Error(`Unsupported attribute type "${exhaustive}"`);
    }
  }
}

export function cloneAttributes(attrs: Attributes | undefined): Attributes | undefined {
  if (!attrs) return undefined;
  return JSON.parse(JSON.stringify(attrs)) as Attributes;
}

export function applyAttributesField(
  target: { attributes?: Attributes },
  value: Attributes | null | undefined
): void {
  if (value === null || value === undefined) {
    delete target.attributes;
    return;
  }
  const normalized = normalizeAttributes(value);
  if (!normalized) {
    delete target.attributes;
  } else {
    target.attributes = normalized;
  }
}

export function normalizeOptionalAttributes(
  value: Attributes | undefined,
  path: string
): Attributes | undefined {
  if (!value) return undefined;
  return normalizeAttributes(validateAttributes(value, path));
}

export function copyOptionalAttributes<T extends { attributes?: Attributes }>(
  source: T
): Pick<T, "attributes"> {
  if (!source.attributes) {
    return {};
  }
  return { attributes: source.attributes };
}
