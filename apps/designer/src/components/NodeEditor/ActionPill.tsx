import type { Project } from "@/core/model/types";
import type { SceneAction } from "@/core/scene/actions";
import { sceneActionGroupColor, sceneActionLabel } from "@/core/scene/actionLabels";
import {
  AssetField,
  DirectionField,
  DurationField,
  NumberField,
  PositionField,
  PropIdField,
  RevealField,
  TextField,
  VariationField,
} from "./ActionFields";
import { DialogueTextField } from "./DialogueTextField";
import { labelStyle } from "./actionFieldStyles";

export type ActionPillProps = {
  action: SceneAction;
  index: number;
  project: Project;
  /** Prop instance ids added before this action, for the id picker. */
  knownPropIds: string[];
  /** Asset backing each known prop id, so variation pickers can be scoped. */
  propAssetIds: Record<string, string>;
  issues: string[];
  onChange: (action: SceneAction) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
};

function ActionBody({
  action,
  project,
  knownPropIds,
  propAssetIds,
  onChange,
}: Pick<ActionPillProps, "action" | "project" | "knownPropIds" | "propAssetIds" | "onChange">) {
  const propId = "id" in action ? action.id : "";
  const propAssetId = propAssetIds[propId] ?? "";

  switch (action.kind) {
    case "bg.show":
      return (
        <AssetField
          project={project}
          types={["backdrop"]}
          value={action.assetId}
          onChange={(assetId) => onChange({ ...action, assetId })}
          placeholder="pick background"
        />
      );
    case "bg.clear":
      return null;
    case "bg.fade":
      return (
        <>
          <AssetField
            project={project}
            types={["backdrop"]}
            value={action.assetId}
            onChange={(assetId) => onChange({ ...action, assetId })}
            placeholder="pick background"
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );
    case "bg.slideIn":
      return (
        <>
          <AssetField
            project={project}
            types={["backdrop"]}
            value={action.assetId}
            onChange={(assetId) => onChange({ ...action, assetId })}
            placeholder="pick background"
          />
          <DirectionField
            value={action.direction}
            onChange={(direction) => onChange({ ...action, direction })}
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );
    case "bg.slideOut":
      return (
        <>
          <DirectionField
            value={action.direction}
            onChange={(direction) => onChange({ ...action, direction })}
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );

    case "prop.add":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <AssetField
            project={project}
            types={["actor", "backdrop"]}
            value={action.assetId}
            onChange={(assetId) => onChange({ ...action, assetId })}
            placeholder="pick asset"
          />
          <VariationField
            project={project}
            assetId={action.assetId}
            value={action.variationId ?? ""}
            allowNone
            onChange={(variationId) =>
              onChange({ ...action, variationId: variationId || undefined })
            }
          />
        </>
      );
    case "prop.remove":
    case "prop.hide":
      return (
        <PropIdField
          value={action.id}
          onChange={(id) => onChange({ ...action, id })}
          knownIds={knownPropIds}
        />
      );
    case "prop.show":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <PositionField
            value={action.position}
            optional
            onChange={(position) => onChange({ ...action, position })}
          />
        </>
      );
    case "prop.fadeIn":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <PositionField
            value={action.position}
            optional
            onChange={(position) => onChange({ ...action, position })}
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );
    case "prop.fadeOut":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );
    case "prop.slideIn":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <PositionField
            value={action.position}
            onChange={(position) => position && onChange({ ...action, position })}
          />
          <DirectionField
            value={action.direction}
            onChange={(direction) => onChange({ ...action, direction })}
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );
    case "prop.slideOut":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <DirectionField
            value={action.direction}
            onChange={(direction) => onChange({ ...action, direction })}
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );
    case "prop.move":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <PositionField
            value={action.position}
            onChange={(position) => position && onChange({ ...action, position })}
          />
          <DurationField
            value={action.durationMs}
            onChange={(durationMs) => onChange({ ...action, durationMs })}
          />
        </>
      );
    case "prop.setPosition":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <PositionField
            value={action.position}
            onChange={(position) => position && onChange({ ...action, position })}
          />
        </>
      );
    case "prop.setZ":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          <NumberField
            label="layer"
            value={action.z}
            onChange={(z) => onChange({ ...action, z })}
          />
        </>
      );
    case "prop.setVariation":
      return (
        <>
          <PropIdField
            value={action.id}
            onChange={(id) => onChange({ ...action, id })}
            knownIds={knownPropIds}
          />
          {propAssetId ? (
            <VariationField
              project={project}
              assetId={propAssetId}
              value={action.variationId}
              onChange={(variationId) => onChange({ ...action, variationId })}
            />
          ) : (
            <TextField
              value={action.variationId}
              onChange={(variationId) => onChange({ ...action, variationId })}
              placeholder="variation id"
            />
          )}
        </>
      );
    case "prop.highlight":
    case "prop.unhighlight":
      return (
        <PropIdField
          value={action.id}
          onChange={(id) => onChange({ ...action, id })}
          knownIds={knownPropIds}
        />
      );

    case "dialogue.show":
      return (
        <AssetField
          project={project}
          types={["actor"]}
          value={action.characterId ?? ""}
          onChange={(characterId) =>
            onChange({ ...action, characterId: characterId || undefined })
          }
          placeholder="character (optional)"
        />
      );
    case "dialogue.hide":
      return null;
    case "dialogue.setWidth":
      return (
        <NumberField
          label="width %"
          value={action.widthPercent}
          onChange={(widthPercent) => onChange({ ...action, widthPercent })}
        />
      );
    case "dialogue.setSpeaker":
      return (
        <DialogueTextField
          project={project}
          value={action.text}
          onChange={(text) => onChange({ ...action, text })}
          placeholder="Speaker (text or @rt…)"
        />
      );
    case "dialogue.revealText":
      return (
        <>
          <DialogueTextField
            project={project}
            value={action.text}
            onChange={(text) => onChange({ ...action, text })}
            placeholder="Dialogue: tags <b>…</b> or Razor @rt / @if"
            multiline
          />
          <RevealField
            value={action.reveal}
            onChange={(reveal) => onChange({ ...action, reveal })}
          />
        </>
      );
    case "dialogue.clear":
    case "dialogue.reset":
      return null;

    case "wait":
      return (
        <DurationField
          label=""
          value={action.milliseconds}
          onChange={(milliseconds) => onChange({ ...action, milliseconds })}
        />
      );
    case "waitForContinue":
      return null;

    case "playSound":
      return (
        <>
          <AssetField
            project={project}
            types={["sound"]}
            value={action.assetId}
            onChange={(assetId) => onChange({ ...action, assetId })}
            placeholder="pick sound"
          />
          <NumberField
            label="delay s"
            step={0.1}
            value={action.delaySeconds}
            onChange={(delaySeconds) => onChange({ ...action, delaySeconds })}
          />
        </>
      );

    case "rt.setBool":
      return (
        <>
          <TextField
            value={action.key}
            onChange={(key) => onChange({ ...action, key })}
            placeholder="state key"
          />
          <label style={{ ...labelStyle, display: "inline-flex", gap: "4px", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={action.value}
              onChange={(e) => onChange({ ...action, value: e.target.checked })}
            />
            true
          </label>
        </>
      );
    case "rt.setInt":
      return (
        <>
          <TextField
            value={action.key}
            onChange={(key) => onChange({ ...action, key })}
            placeholder="state key"
          />
          <NumberField
            label="="
            value={action.value}
            onChange={(value) => onChange({ ...action, value })}
          />
        </>
      );
    case "rt.setString":
      return (
        <>
          <TextField
            value={action.key}
            onChange={(key) => onChange({ ...action, key })}
            placeholder="state key"
          />
          <TextField
            value={action.value}
            onChange={(value) => onChange({ ...action, value })}
            placeholder="value"
          />
        </>
      );
    case "rt.emit":
      return (
        <TextField
          value={action.eventName}
          onChange={(eventName) => onChange({ ...action, eventName })}
          placeholder="event name"
        />
      );

    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled action pill: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function ActionPill({
  action,
  index,
  project,
  knownPropIds,
  propAssetIds,
  issues,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDropTarget,
}: ActionPillProps) {
  const accent = sceneActionGroupColor(action.kind);

  return (
    <li
      data-testid={`action-pill-${index}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "6px 8px",
        borderRadius: "8px",
        border: `1px solid ${issues.length > 0 ? "#b45309" : "var(--app-border)"}`,
        borderLeft: `4px solid ${accent}`,
        background: isDropTarget ? "var(--app-surface-hover, rgba(127,127,127,0.12))" : "var(--app-surface)",
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      <span
        draggable
        onDragStart={onDragStart}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        style={{
          cursor: "grab",
          userSelect: "none",
          color: "var(--app-text-muted, #64748b)",
          lineHeight: 1.6,
          padding: "0 2px",
        }}
      >
        ⠿
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: accent, whiteSpace: "nowrap" }}>
            {sceneActionLabel(action.kind)}
          </span>
          <ActionBody
            action={action}
            project={project}
            knownPropIds={knownPropIds}
            propAssetIds={propAssetIds}
            onChange={onChange}
          />
        </div>
        {issues.map((issue) => (
          <p key={issue} style={{ margin: 0, fontSize: "11px", color: "#b45309" }}>
            {issue}
          </p>
        ))}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Delete ${sceneActionLabel(action.kind)}`}
        title="Delete action"
        style={{
          border: "none",
          background: "transparent",
          color: "var(--app-text-muted, #64748b)",
          cursor: "pointer",
          fontSize: "14px",
          lineHeight: 1.4,
          padding: "0 2px",
        }}
      >
        ×
      </button>
    </li>
  );
}
