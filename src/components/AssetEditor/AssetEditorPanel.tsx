import { useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { Asset, AssetType, ActorExpression } from "@/core/model/types";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { useActorExpressionUrl } from "@/hooks/useActorExpressionUrl";
import { getAssetUsage } from "@/core/assets/assetUsage";
import { getExpressionUsage } from "@/core/assets/actorExpressions";
import { canRemoveAsset, canRenameAsset, canReplaceAsset, isDefaultBackdrop } from "@/core/assets/defaultBackdrop";
import { CloseButton } from "../CloseButton";
import { AddButton } from "../AddButton";
import { isElectron } from "@/utils/isElectron";

const PANEL_STYLE: React.CSSProperties = {
  width: "320px",
  borderLeft: "1px solid var(--app-border)",
  padding: "12px",
  background: "var(--app-surface-muted)",
  overflowY: "auto",
  maxHeight: "100vh",
};

const TEXTAREA_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "4px",
  padding: "6px",
  minHeight: "64px",
  resize: "vertical",
  boxSizing: "border-box",
};

function assetTypeLabel(type: AssetType): string {
  switch (type) {
    case "backdrop":
      return "Backdrop";
    case "actor":
      return "Actor";
    case "sound":
      return "Sound";
  }
}

function UsageSummary({ asset }: { asset: Asset }) {
  const project = useProjectStore((s) => s.project);
  const usage = getAssetUsage(project, asset.id);

  if (usage.total === 0) {
    return (
      <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--app-text-muted)" }}>
        Not used in any scenes.
      </p>
    );
  }

  const parts: string[] = [];
  if (asset.type === "backdrop" && usage.backdropScenes > 0) {
    parts.push(`${usage.backdropScenes} scene${usage.backdropScenes === 1 ? "" : "s"} as backdrop`);
  }
  if (asset.type === "actor" && usage.actorScenes > 0) {
    parts.push(`${usage.actorScenes} scene${usage.actorScenes === 1 ? "" : "s"} as actor`);
  }
  if (asset.type === "sound" && usage.soundSlots > 0) {
    parts.push(`${usage.soundSlots} sound slot${usage.soundSlots === 1 ? "" : "s"}`);
  }

  return (
    <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--app-text-muted)" }}>
      Used in {parts.join(", ")}.
    </p>
  );
}

function ActorNotesFields({
  asset,
  updateAsset,
  flushHistoryCoalesce,
}: {
  asset: Asset;
  updateAsset: ReturnType<typeof useProjectStore.getState>["updateAsset"];
  flushHistoryCoalesce: () => void;
}) {
  const fields: Array<{ key: "personality" | "appearance" | "backstory" | "notes"; label: string }> = [
    { key: "personality", label: "Personality" },
    { key: "appearance", label: "Appearance" },
    { key: "backstory", label: "Backstory" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <>
      {fields.map(({ key, label }) => (
        <label key={key} style={{ display: "block", marginBottom: "12px" }}>
          {label}
          <textarea
            value={asset[key] ?? ""}
            onChange={(e) =>
              updateAsset(asset.id, { [key]: e.target.value || undefined }, { mergeKey: `asset-${key}:${asset.id}` })
            }
            onBlur={() => flushHistoryCoalesce()}
            style={TEXTAREA_STYLE}
          />
        </label>
      ))}
    </>
  );
}

function ExpressionRow({
  asset,
  expression,
  onReplace,
  onRemove,
  onRename,
  onBlurRename,
}: {
  asset: Asset;
  expression: ActorExpression;
  onReplace: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onBlurRename: () => void;
}) {
  const project = useProjectStore((s) => s.project);
  const previewUrl = useActorExpressionUrl(project, asset.id, expression.id);
  const usage = getExpressionUsage(project, asset.id, expression.id);
  const isLast = (asset.expressions?.length ?? 0) <= 1;
  const canDelete = usage === 0 && !isLast;
  const deleteTitle = isLast
    ? "An actor must have at least one expression"
    : usage > 0
      ? `Used in ${usage} scene${usage === 1 ? "" : "s"}`
      : "Remove expression";

  return (
    <div
      style={{
        border: "1px solid var(--app-border-subtle)",
        borderRadius: "6px",
        padding: "8px",
        marginBottom: "8px",
      }}
    >
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            flexShrink: 0,
            borderRadius: "4px",
            overflow: "hidden",
            background: "var(--app-border-subtle)",
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : null}
        </div>
        <label style={{ flex: 1, fontSize: "12px" }}>
          Name
          <input
            type="text"
            value={expression.name}
            onChange={(e) => onRename(e.target.value)}
            onBlur={onBlurRename}
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "4px 6px", boxSizing: "border-box" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={onReplace}
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: "12px",
            border: "1px solid var(--app-border)",
            borderRadius: "6px",
            background: "var(--app-surface)",
            cursor: "pointer",
          }}
        >
          Replace image…
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canDelete}
          title={deleteTitle}
          style={{
            padding: "6px 8px",
            fontSize: "12px",
            border: "1px solid var(--app-border)",
            borderRadius: "6px",
            background: "var(--app-surface)",
            color: "var(--app-danger, #c0392b)",
            cursor: canDelete ? "pointer" : "not-allowed",
            opacity: canDelete ? 1 : 0.5,
          }}
        >
          Remove
        </button>
      </div>
      {usage > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--app-text-muted)" }}>
          Used in {usage} scene{usage === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}

export function AssetEditorPanel() {
  const selectedAssetId = useProjectStore((s) => s.selectedAssetId);
  const project = useProjectStore((s) => s.project);
  const setSelectedAssetId = useProjectStore((s) => s.setSelectedAssetId);
  const updateAsset = useProjectStore((s) => s.updateAsset);
  const replaceAssetMedia = useProjectStore((s) => s.replaceAssetMedia);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const addActorExpression = useProjectStore((s) => s.addActorExpression);
  const updateActorExpression = useProjectStore((s) => s.updateActorExpression);
  const replaceActorExpressionMedia = useProjectStore((s) => s.replaceActorExpressionMedia);
  const removeActorExpression = useProjectStore((s) => s.removeActorExpression);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceExpressionRef = useRef<{ actorId: string; expressionId: string } | null>(null);
  const [expressionNameError, setExpressionNameError] = useState<string | null>(null);

  const asset = selectedAssetId
    ? project.assets.find((a) => a.id === selectedAssetId)
    : undefined;
  const previewUrl = useAssetUrl(project, asset?.type === "actor" ? null : (asset?.id ?? null));

  if (!asset) return null;

  const renamable = canRenameAsset(asset.id);
  const removable = canRemoveAsset(asset.id);
  const replaceable = canReplaceAsset(asset.id) && asset.type !== "actor";
  const isDefault = isDefaultBackdrop(asset.id);

  const triggerReplace = () => {
    if (!replaceable) return;

    if (isElectron() && window.electronAPI?.openFileDialog) {
      window.electronAPI
        .openFileDialog({ type: asset.type, multiple: false })
        .then((paths) => {
          const filePath = paths[0];
          if (!filePath) return;
          void replaceAssetMedia(asset.id, { path: filePath });
        });
      return;
    }

    const input = fileInputRef.current;
    if (!input) return;
    input.accept =
      asset.type === "sound"
        ? "audio/mpeg,audio/wav,audio/ogg,audio/mp4"
        : "image/png,image/jpeg,image/gif,image/webp";
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void replaceAssetMedia(asset.id, { file });
      input.value = "";
      replaceExpressionRef.current = null;
    };
    input.click();
  };

  const triggerReplaceExpression = (expressionId: string) => {
    replaceExpressionRef.current = { actorId: asset.id, expressionId };

    if (isElectron() && window.electronAPI?.openFileDialog) {
      window.electronAPI
        .openFileDialog({ type: "actor", multiple: false })
        .then((paths) => {
          const filePath = paths[0];
          if (!filePath) return;
          void replaceActorExpressionMedia(asset.id, expressionId, { path: filePath });
        });
      return;
    }

    const input = fileInputRef.current;
    if (!input) return;
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      const target = replaceExpressionRef.current;
      if (file && target) {
        void replaceActorExpressionMedia(target.actorId, target.expressionId, { file });
      }
      input.value = "";
      replaceExpressionRef.current = null;
    };
    input.click();
  };

  const handleRemove = async () => {
    await removeAsset(asset.id);
    setSelectedAssetId(null);
  };

  const handleAddExpression = () => {
    const name = window.prompt("Expression name", "happy")?.trim();
    if (!name) return;
    try {
      addActorExpression(asset.id, name);
      setExpressionNameError(null);
    } catch (error) {
      setExpressionNameError(error instanceof Error ? error.message : "Could not add expression");
    }
  };

  return (
    <div style={PANEL_STYLE}>
      <input ref={fileInputRef} type="file" style={{ display: "none" }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <strong>{assetTypeLabel(asset.type)}</strong>
        <CloseButton onClick={() => setSelectedAssetId(null)} />
      </div>

      <label style={{ display: "block", marginBottom: "12px" }}>
        Name
        <input
          type="text"
          value={asset.name}
          readOnly={!renamable}
          onChange={(e) =>
            updateAsset(asset.id, { name: e.target.value }, { mergeKey: `asset-name:${asset.id}` })
          }
          onBlur={() => flushHistoryCoalesce()}
          style={{
            display: "block",
            width: "100%",
            marginTop: "4px",
            padding: "6px",
            opacity: renamable ? 1 : 0.7,
          }}
        />
      </label>

      {asset.type === "actor" ? (
        <>
          <ActorNotesFields
            asset={asset}
            updateAsset={updateAsset}
            flushHistoryCoalesce={flushHistoryCoalesce}
          />
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 600 }}>Expressions</span>
              <AddButton onClick={handleAddExpression} title="Add expression" />
            </div>
            {expressionNameError && (
              <p style={{ margin: "0 0 8px", fontSize: "11px", color: "var(--app-node-invalid-border)" }}>
                {expressionNameError}
              </p>
            )}
            {(asset.expressions ?? []).map((expression) => (
              <ExpressionRow
                key={expression.id}
                asset={asset}
                expression={expression}
                onReplace={() => triggerReplaceExpression(expression.id)}
                onRemove={() => {
                  try {
                    removeActorExpression(asset.id, expression.id);
                    setExpressionNameError(null);
                  } catch (error) {
                    setExpressionNameError(
                      error instanceof Error ? error.message : "Could not remove expression"
                    );
                  }
                }}
                onRename={(name) => {
                  try {
                    updateActorExpression(
                      asset.id,
                      expression.id,
                      { name },
                      { mergeKey: `actor-expression-name:${asset.id}:${expression.id}` }
                    );
                    setExpressionNameError(null);
                  } catch (error) {
                    setExpressionNameError(
                      error instanceof Error ? error.message : "Invalid expression name"
                    );
                  }
                }}
                onBlurRename={() => flushHistoryCoalesce()}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ marginBottom: "6px", fontSize: "12px" }}>Preview</div>
            {asset.type === "sound" ? (
              previewUrl ? (
                <audio key={previewUrl} controls src={previewUrl} style={{ width: "100%" }} />
              ) : (
                <div style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>No audio loaded.</div>
              )
            ) : previewUrl ? (
              <img
                key={previewUrl}
                src={previewUrl}
                alt={asset.name}
                style={{
                  width: "100%",
                  maxHeight: "180px",
                  objectFit: "contain",
                  borderRadius: "6px",
                  border: "1px solid var(--app-border-subtle)",
                  background: "var(--app-surface)",
                }}
              />
            ) : (
              <div style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>No image loaded.</div>
            )}
          </div>

          {replaceable && (
            <button
              type="button"
              onClick={triggerReplace}
              style={{
                width: "100%",
                marginBottom: isDefault ? "8px" : "12px",
                padding: "8px 12px",
                border: "1px solid var(--app-border)",
                borderRadius: "6px",
                background: "var(--app-surface)",
                color: "var(--app-text)",
                cursor: "pointer",
              }}
            >
              Replace {asset.type === "sound" ? "audio" : "image"}…
            </button>
          )}
        </>
      )}

      {isDefault && (
        <p style={{ margin: "0 0 12px", fontSize: "11px", color: "var(--app-text-muted)" }}>
          Built-in default backdrop. You can replace its image; name and removal stay fixed.
        </p>
      )}

      <UsageSummary asset={asset} />

      <p style={{ margin: "0 0 12px", fontSize: "11px", color: "var(--app-text-subtle)" }}>
        ID: <code style={{ fontSize: "11px" }}>{asset.id}</code>
      </p>

      {removable && (
        <button
          type="button"
          onClick={() => void handleRemove()}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--app-border)",
            borderRadius: "6px",
            background: "var(--app-surface)",
            color: "var(--app-danger, #c0392b)",
            cursor: "pointer",
          }}
        >
          Remove asset
        </button>
      )}
    </div>
  );
}
