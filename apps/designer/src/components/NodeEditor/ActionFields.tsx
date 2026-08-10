import type { Asset, Project } from "@/core/model/types";
import type { RevealSpec } from "@/core/scene/actions";
import {
  DIRECTIONS,
  POSITION_SLOTS,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  type Direction,
  type StagePosition,
} from "@/core/scene/positions";
import {
  fieldGroupStyle,
  fieldStyle,
  labelStyle,
  numberFieldStyle,
} from "./actionFieldStyles";

export function AssetField({
  project,
  types,
  value,
  onChange,
  placeholder,
}: {
  project: Project;
  types: Asset["type"][];
  value: string;
  onChange: (assetId: string) => void;
  placeholder: string;
}) {
  const assets = project.assets.filter((asset) => types.includes(asset.type));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...fieldStyle, maxWidth: "180px" }}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {assets.map((asset) => (
        <option key={asset.id} value={asset.id}>
          {asset.name}
        </option>
      ))}
    </select>
  );
}

export function VariationField({
  project,
  assetId,
  value,
  onChange,
  allowNone,
}: {
  project: Project;
  assetId: string;
  value: string;
  onChange: (variationId: string) => void;
  allowNone?: boolean;
}) {
  const expressions = project.assets.find((asset) => asset.id === assetId)?.expressions ?? [];
  if (expressions.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...fieldStyle, maxWidth: "140px" }}
      aria-label="Variation"
    >
      <option value="">{allowNone ? "default" : "pick variation"}</option>
      {expressions.map((expression) => (
        <option key={expression.id} value={expression.id}>
          {expression.name}
        </option>
      ))}
    </select>
  );
}

export function PropIdField({
  value,
  onChange,
  knownIds,
}: {
  value: string;
  onChange: (id: string) => void;
  knownIds: string[];
}) {
  const listId = `prop-ids-${knownIds.join("-") || "empty"}`;
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder="prop id"
        aria-label="Prop id"
        style={{ ...fieldStyle, width: "110px" }}
      />
      <datalist id={listId}>
        {knownIds.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
    </>
  );
}

export function DirectionField({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (direction: Direction) => void;
}) {
  return (
    <span style={fieldGroupStyle}>
      <span style={labelStyle}>from</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Direction)}
        style={fieldStyle}
        aria-label="Direction"
      >
        {DIRECTIONS.map((direction) => (
          <option key={direction} value={direction}>
            {direction}
          </option>
        ))}
      </select>
    </span>
  );
}

export function DurationField({
  value,
  onChange,
  label = "for",
}: {
  value: number;
  onChange: (durationMs: number) => void;
  label?: string;
}) {
  return (
    <span style={fieldGroupStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        min={0}
        step={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={numberFieldStyle}
        aria-label="Duration in milliseconds"
      />
      <span style={labelStyle}>ms</span>
    </span>
  );
}

export function PositionField({
  value,
  onChange,
  optional,
}: {
  value: StagePosition | undefined;
  onChange: (position: StagePosition | undefined) => void;
  optional?: boolean;
}) {
  const mode = value === undefined ? "keep" : value.kind;

  const handleMode = (next: string) => {
    if (next === "keep") {
      onChange(undefined);
      return;
    }
    if (next === "slot") {
      onChange({ kind: "slot", slot: "Centre" });
      return;
    }
    onChange({ kind: "vec", x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 });
  };

  return (
    <span style={fieldGroupStyle}>
      <span style={labelStyle}>at</span>
      <select
        value={mode}
        onChange={(e) => handleMode(e.target.value)}
        style={fieldStyle}
        aria-label="Position mode"
      >
        {optional && <option value="keep">current</option>}
        <option value="slot">slot</option>
        <option value="vec">x / y</option>
      </select>
      {value?.kind === "slot" && (
        <select
          value={value.slot}
          onChange={(e) =>
            onChange({ kind: "slot", slot: e.target.value as (typeof POSITION_SLOTS)[number] })
          }
          style={fieldStyle}
          aria-label="Position slot"
        >
          {POSITION_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      )}
      {value?.kind === "vec" && (
        <>
          <input
            type="number"
            min={0}
            max={STAGE_WIDTH}
            step={0.1}
            value={value.x}
            onChange={(e) => onChange({ kind: "vec", x: Number(e.target.value), y: value.y })}
            style={numberFieldStyle}
            aria-label="Position x"
          />
          <input
            type="number"
            min={0}
            max={STAGE_HEIGHT}
            step={0.1}
            value={value.y}
            onChange={(e) => onChange({ kind: "vec", x: value.x, y: Number(e.target.value) })}
            style={numberFieldStyle}
            aria-label="Position y"
          />
        </>
      )}
    </span>
  );
}

const REVEAL_MODE_LABELS: Record<RevealSpec["mode"], string> = {
  instant: "instantly",
  charsPerSecond: "chars/sec",
  wordsPerSecond: "words/sec",
  charsOverTime: "chars over",
  wordsOverTime: "words over",
};

export function RevealField({
  value,
  onChange,
}: {
  value: RevealSpec;
  onChange: (reveal: RevealSpec) => void;
}) {
  const handleMode = (mode: RevealSpec["mode"]) => {
    switch (mode) {
      case "instant":
        onChange({ mode });
        return;
      case "charsPerSecond":
      case "wordsPerSecond":
        onChange({ mode, rate: -1 });
        return;
      default:
        onChange({ mode, durationMs: 1000 });
    }
  };

  return (
    <span style={fieldGroupStyle}>
      <span style={labelStyle}>reveal</span>
      <select
        value={value.mode}
        onChange={(e) => handleMode(e.target.value as RevealSpec["mode"])}
        style={fieldStyle}
        aria-label="Reveal mode"
      >
        {(Object.keys(REVEAL_MODE_LABELS) as RevealSpec["mode"][]).map((mode) => (
          <option key={mode} value={mode}>
            {REVEAL_MODE_LABELS[mode]}
          </option>
        ))}
      </select>
      {(value.mode === "charsPerSecond" || value.mode === "wordsPerSecond") && (
        <input
          type="number"
          step={1}
          value={value.rate}
          onChange={(e) => onChange({ mode: value.mode, rate: Number(e.target.value) })}
          style={numberFieldStyle}
          aria-label="Reveal rate (-1 uses the project default)"
          title="-1 uses the project default rate"
        />
      )}
      {(value.mode === "charsOverTime" || value.mode === "wordsOverTime") && (
        <>
          <input
            type="number"
            min={0}
            step={50}
            value={value.durationMs}
            onChange={(e) => onChange({ mode: value.mode, durationMs: Number(e.target.value) })}
            style={numberFieldStyle}
            aria-label="Reveal duration in milliseconds"
          />
          <span style={labelStyle}>ms</span>
        </>
      )}
    </span>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  width,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  width?: string;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        style={{
          ...fieldStyle,
          flex: 1,
          minWidth: "220px",
          resize: "vertical",
          lineHeight: 1.4,
        }}
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      style={{ ...fieldStyle, width: width ?? "140px" }}
    />
  );
}

export function NumberField({
  value,
  onChange,
  label,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  step?: number;
}) {
  return (
    <span style={fieldGroupStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={numberFieldStyle}
        aria-label={label}
      />
    </span>
  );
}
