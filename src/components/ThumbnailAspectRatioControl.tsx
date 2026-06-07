import { useEffect, useState } from "react";
import { useDesignerStore } from "@/store/designerStore";
import {
  findPresetKey,
  THUMBNAIL_ASPECT_RATIO_GROUP_LABELS,
  THUMBNAIL_ASPECT_RATIO_GROUP_ORDER,
  THUMBNAIL_ASPECT_RATIO_PRESETS,
  type AspectRatio,
} from "@/core/view/thumbnailAspectRatio";

const CUSTOM_PRESET_KEY = "custom";

function parseCustomRatio(width: string, height: string): AspectRatio | null {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { width: Math.round(w), height: Math.round(h) };
}

export function ThumbnailAspectRatioControl() {
  const ratio = useDesignerStore((s) => s.thumbnailAspectRatio);
  const setRatio = useDesignerStore((s) => s.setThumbnailAspectRatio);
  const matchedPresetKey = findPresetKey(ratio);
  const [customMode, setCustomMode] = useState(matchedPresetKey === CUSTOM_PRESET_KEY);
  const selectValue = customMode ? CUSTOM_PRESET_KEY : matchedPresetKey;

  useEffect(() => {
    if (matchedPresetKey !== CUSTOM_PRESET_KEY) {
      setCustomMode(false);
    }
  }, [matchedPresetKey]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        color: "var(--app-text-muted)",
      }}
    >
      <label htmlFor="thumbnail-aspect-ratio" style={{ whiteSpace: "nowrap" }}>
        Thumbnail ratio
      </label>
      <select
        id="thumbnail-aspect-ratio"
        value={selectValue}
        onChange={(e) => {
          const key = e.target.value;
          if (key === CUSTOM_PRESET_KEY) {
            setCustomMode(true);
            return;
          }
          setCustomMode(false);
          const preset = THUMBNAIL_ASPECT_RATIO_PRESETS.find((item) => item.key === key);
          if (preset) setRatio(preset.ratio);
        }}
        style={{
          padding: "4px 8px",
          borderRadius: "4px",
          border: "1px solid var(--app-border)",
          background: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        {THUMBNAIL_ASPECT_RATIO_GROUP_ORDER.map((group) => (
          <optgroup key={group} label={THUMBNAIL_ASPECT_RATIO_GROUP_LABELS[group]}>
            {THUMBNAIL_ASPECT_RATIO_PRESETS.filter((preset) => preset.group === group).map(
              (preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              )
            )}
          </optgroup>
        ))}
        <option value={CUSTOM_PRESET_KEY}>Custom</option>
      </select>
      {customMode && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <input
            type="number"
            min={1}
            step={1}
            value={ratio.width}
            onChange={(e) => {
              const next = parseCustomRatio(e.target.value, String(ratio.height));
              if (next) setRatio(next);
            }}
            aria-label="Custom aspect width"
            style={{
              width: "52px",
              padding: "4px 6px",
              borderRadius: "4px",
              border: "1px solid var(--app-border)",
              background: "var(--app-input-bg)",
              color: "var(--app-text)",
            }}
          />
          <span>:</span>
          <input
            type="number"
            min={1}
            step={1}
            value={ratio.height}
            onChange={(e) => {
              const next = parseCustomRatio(String(ratio.width), e.target.value);
              if (next) setRatio(next);
            }}
            aria-label="Custom aspect height"
            style={{
              width: "52px",
              padding: "4px 6px",
              borderRadius: "4px",
              border: "1px solid var(--app-border)",
              background: "var(--app-input-bg)",
              color: "var(--app-text)",
            }}
          />
        </div>
      )}
    </div>
  );
}
