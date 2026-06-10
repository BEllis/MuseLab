import { useMemo, useState } from "react";
import type { AttributeValue, AttributeValueType, Attributes } from "@/core/model/types";
import {
  cloneAttributes,
  createDefaultAttributeValue,
  normalizeAttributes,
} from "@/core/model/attributes";
import { AddButton } from "../AddButton";
import { CloseButton } from "../CloseButton";

const ATTRIBUTE_TYPES: AttributeValueType[] = ["string", "integer", "number", "object", "list"];

const INPUT_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "4px",
  padding: "4px 6px",
  boxSizing: "border-box",
  fontSize: "12px",
};

const ROW_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border-subtle)",
  borderRadius: "6px",
  padding: "8px",
  marginBottom: "8px",
};

type AttributesEditorProps = {
  attributes: Attributes | undefined;
  onChange: (next: Attributes | undefined, mergeKey: string) => void;
  mergeKeyPrefix: string;
  flushHistoryCoalesce: () => void;
  depth?: number;
  title?: string;
  compact?: boolean;
};

function buildMergeKey(prefix: string, path: string[]): string {
  return path.length === 0 ? prefix : `${prefix}:${path.join(".")}`;
}

function ListAttributeEditor({
  value,
  path,
  mergeKeyPrefix,
  onValueChange,
  flushHistoryCoalesce,
  depth,
}: {
  value: AttributeValue[];
  path: string[];
  mergeKeyPrefix: string;
  onValueChange: (next: AttributeValue, mergeKey: string) => void;
  flushHistoryCoalesce: () => void;
  depth: number;
}) {
  const updateList = (next: AttributeValue[], itemPath: string[]) => {
    onValueChange({ type: "list", value: next }, buildMergeKey(mergeKeyPrefix, itemPath));
  };

  return (
    <div style={{ marginTop: "6px" }}>
      {value.map((item, index) => (
        <div key={index} style={{ ...ROW_STYLE, marginBottom: "6px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--app-text-muted)" }}>Item {index + 1}</span>
            <select
              value={item.type}
              onChange={(e) => {
                const next = [...value];
                next[index] = createDefaultAttributeValue(e.target.value as AttributeValueType);
                updateList(next, [...path, String(index)]);
              }}
              style={{ flex: 1, fontSize: "12px" }}
            >
              {ATTRIBUTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <CloseButton
              title="Remove item"
              onClick={() => {
                const next = value.filter((_, i) => i !== index);
                updateList(next, [...path, String(index)]);
              }}
            />
          </div>
          <AttributeValueFields
            value={item}
            path={[...path, String(index)]}
            mergeKeyPrefix={mergeKeyPrefix}
            onValueChange={(_next, mergeKey) => {
              const updated = [...value];
              updated[index] = _next;
              onValueChange({ type: "list", value: updated }, mergeKey);
            }}
            flushHistoryCoalesce={flushHistoryCoalesce}
            depth={depth}
          />
        </div>
      ))}
      <AddButton
        title="Add list item"
        onClick={() => {
          updateList([...value, createDefaultAttributeValue("string")], [...path, String(value.length)]);
        }}
      />
    </div>
  );
}

function AttributeValueFields({
  value,
  path,
  mergeKeyPrefix,
  onValueChange,
  flushHistoryCoalesce,
  depth,
}: {
  value: AttributeValue;
  path: string[];
  mergeKeyPrefix: string;
  onValueChange: (next: AttributeValue, mergeKey: string) => void;
  flushHistoryCoalesce: () => void;
  depth: number;
}) {
  switch (value.type) {
    case "string":
      return (
        <input
          type="text"
          value={value.value}
          onChange={(e) =>
            onValueChange({ type: "string", value: e.target.value }, buildMergeKey(mergeKeyPrefix, path))
          }
          onBlur={flushHistoryCoalesce}
          style={INPUT_STYLE}
        />
      );
    case "integer":
      return (
        <input
          type="number"
          step={1}
          value={value.value}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (!Number.isInteger(parsed)) return;
            onValueChange({ type: "integer", value: parsed }, buildMergeKey(mergeKeyPrefix, path));
          }}
          onBlur={flushHistoryCoalesce}
          style={INPUT_STYLE}
        />
      );
    case "number":
      return (
        <input
          type="number"
          step="any"
          value={value.value}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isNaN(parsed)) return;
            onValueChange({ type: "number", value: parsed }, buildMergeKey(mergeKeyPrefix, path));
          }}
          onBlur={flushHistoryCoalesce}
          style={INPUT_STYLE}
        />
      );
    case "object":
      return (
        <AttributesEditor
          attributes={value.value}
          onChange={(next, mergeKey) => {
            onValueChange({ type: "object", value: next ?? {} }, mergeKey);
          }}
          mergeKeyPrefix={mergeKeyPrefix}
          flushHistoryCoalesce={flushHistoryCoalesce}
          depth={depth + 1}
          compact
        />
      );
    case "list":
      return (
        <ListAttributeEditor
          value={value.value}
          path={path}
          mergeKeyPrefix={mergeKeyPrefix}
          onValueChange={onValueChange}
          flushHistoryCoalesce={flushHistoryCoalesce}
          depth={depth}
        />
      );
    default: {
      const exhaustive: never = value;
      return <span>{String(exhaustive)}</span>;
    }
  }
}

function AttributeRow({
  entryKey,
  value,
  path,
  mergeKeyPrefix,
  usedKeys,
  onRename,
  onRemove,
  onValueChange,
  flushHistoryCoalesce,
  depth,
}: {
  entryKey: string;
  value: AttributeValue;
  path: string[];
  mergeKeyPrefix: string;
  usedKeys: Set<string>;
  onRename: (oldKey: string, newKey: string) => void;
  onRemove: (key: string) => void;
  onValueChange: (key: string, next: AttributeValue, mergeKey: string) => void;
  flushHistoryCoalesce: () => void;
  depth: number;
}) {
  const [draftKey, setDraftKey] = useState(entryKey);
  const trimmed = draftKey.trim();
  const keyError =
    trimmed.length === 0
      ? "Key is required"
      : trimmed !== entryKey && usedKeys.has(trimmed)
        ? "Key must be unique"
        : null;

  return (
    <div style={ROW_STYLE}>
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "6px" }}>
        <label style={{ flex: 1, fontSize: "12px" }}>
          Key
          <input
            type="text"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onBlur={() => {
              if (!keyError && trimmed && trimmed !== entryKey) {
                onRename(entryKey, trimmed);
              } else if (!trimmed) {
                setDraftKey(entryKey);
              }
              flushHistoryCoalesce();
            }}
            style={{
              ...INPUT_STYLE,
              border: keyError ? "1px solid var(--app-accent)" : undefined,
            }}
          />
        </label>
        <label style={{ width: "110px", fontSize: "12px", flexShrink: 0 }}>
          Type
          <select
            value={value.type}
            onChange={(e) =>
              onValueChange(
                entryKey,
                createDefaultAttributeValue(e.target.value as AttributeValueType),
                buildMergeKey(mergeKeyPrefix, [...path, entryKey])
              )
            }
            style={{ ...INPUT_STYLE, marginTop: "4px" }}
          >
            {ATTRIBUTE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <CloseButton title="Remove attribute" onClick={() => onRemove(entryKey)} />
      </div>
      {keyError && (
        <p style={{ margin: "0 0 6px", fontSize: "11px", color: "var(--app-node-invalid-border)" }}>
          {keyError}
        </p>
      )}
      <AttributeValueFields
        value={value}
        path={[...path, entryKey]}
        mergeKeyPrefix={mergeKeyPrefix}
        onValueChange={(next, mergeKey) => onValueChange(entryKey, next, mergeKey)}
        flushHistoryCoalesce={flushHistoryCoalesce}
        depth={depth}
      />
    </div>
  );
}

export function AttributesEditor({
  attributes,
  onChange,
  mergeKeyPrefix,
  flushHistoryCoalesce,
  depth = 0,
  title = "Attributes",
  compact = false,
}: AttributesEditorProps) {
  const [expanded, setExpanded] = useState(depth > 0 || !compact);
  const entries = useMemo(() => Object.entries(attributes ?? {}), [attributes]);
  const usedKeys = useMemo(() => new Set(Object.keys(attributes ?? {})), [attributes]);

  const commitAttributes = (next: Attributes | undefined, mergeKey: string) => {
    onChange(normalizeAttributes(next), mergeKey);
  };

  const handleRename = (oldKey: string, newKey: string) => {
    if (!attributes || oldKey === newKey) return;
    const next = { ...attributes };
    next[newKey] = next[oldKey];
    delete next[oldKey];
    commitAttributes(next, buildMergeKey(mergeKeyPrefix, [newKey]));
  };

  const handleRemove = (key: string) => {
    if (!attributes) return;
    const next = { ...attributes };
    delete next[key];
    commitAttributes(normalizeAttributes(next), buildMergeKey(mergeKeyPrefix, [key]));
  };

  const handleValueChange = (key: string, nextValue: AttributeValue, mergeKey: string) => {
    const next = { ...(attributes ?? {}), [key]: nextValue };
    commitAttributes(next, mergeKey);
  };

  const handleAdd = () => {
    const base = cloneAttributes(attributes) ?? {};
    let candidate = "attribute";
    let index = 1;
    while (base[candidate]) {
      candidate = `attribute${index}`;
      index += 1;
    }
    base[candidate] = createDefaultAttributeValue("string");
    commitAttributes(base, buildMergeKey(mergeKeyPrefix, [candidate]));
    setExpanded(true);
  };

  return (
    <div style={{ marginBottom: compact ? "0" : "16px", paddingLeft: depth > 0 ? "8px" : 0 }}>
      {depth === 0 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            width: "100%",
            marginBottom: expanded ? "8px" : 0,
            padding: 0,
            border: "none",
            background: "transparent",
            color: "var(--app-text)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: "10px" }}>{expanded ? "▼" : "▶"}</span>
          {title}
        </button>
      )}
      {(expanded || depth > 0) && (
        <>
          {entries.map(([key, value]) => (
            <AttributeRow
              key={key}
              entryKey={key}
              value={value}
              path={[]}
              mergeKeyPrefix={mergeKeyPrefix}
              usedKeys={usedKeys}
              onRename={handleRename}
              onRemove={handleRemove}
              onValueChange={handleValueChange}
              flushHistoryCoalesce={flushHistoryCoalesce}
              depth={depth}
            />
          ))}
          <AddButton onClick={handleAdd} title="Add attribute" />
        </>
      )}
    </div>
  );
}
