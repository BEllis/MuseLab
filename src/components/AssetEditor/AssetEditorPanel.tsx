import { useRef, useState, useEffect, useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { Asset, AssetType, ActorExpression } from "@/core/model/types";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { useActorExpressionUrl } from "@/hooks/useActorExpressionUrl";
import { getAssetUsage } from "@/core/assets/assetUsage";
import { getExpressionUsage, isDefaultExpression } from "@/core/assets/actorExpressions";
import { canRenameAsset, canReplaceAsset, isDefaultBackdrop } from "@/core/assets/defaultBackdrop";
import { CloseButton } from "../CloseButton";
import { ReplaceImageButton } from "../ReplaceImageButton";
import { AddButton } from "../AddButton";
import { isElectron } from "@/utils/isElectron";
import { getSortedActorExpressions } from "@/core/model/assetTree";
import { InspectorPanelDetails, InspectorPanelId, inspectorSubtextStyle } from "../InspectorPanelMeta";

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
      <p style={inspectorSubtextStyle}>
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
    <p style={inspectorSubtextStyle}>
      Used in {parts.join(", ")}.
    </p>
  );
}

function AssetDetailsUnderName({ asset, isDefault }: { asset: Asset; isDefault: boolean }) {
  return (
    <InspectorPanelDetails>
      <UsageSummary asset={asset} />
      {isDefault && (
        <p style={{ ...inspectorSubtextStyle, fontSize: "11px" }}>
          Built-in default backdrop. You can replace its image; name and removal stay fixed.
        </p>
      )}
    </InspectorPanelDetails>
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
  const fields: Array<{
    key: "personality" | "appearance" | "voiceAccent" | "backstory" | "notes";
    label: string;
  }> = [
    { key: "personality", label: "Personality" },
    { key: "appearance", label: "Appearance" },
    { key: "voiceAccent", label: "Voice / Accent" },
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
  isDefault,
  onSetDefault,
  onReplace,
  onRemove,
  onRename,
  onBlurRename,
  autoFocusName = false,
  nameRequired = false,
}: {
  asset: Asset;
  expression: ActorExpression;
  isDefault: boolean;
  onSetDefault: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onBlurRename: () => boolean;
  autoFocusName?: boolean;
  nameRequired?: boolean;
}) {
  const project = useProjectStore((s) => s.project);
  const previewUrl = useActorExpressionUrl(project, asset.id, expression.id);
  const usage = getExpressionUsage(project, asset.id, expression.id);
  const isLast = (asset.expressions?.length ?? 0) <= 1;
  const canDelete = usage === 0 && !isLast;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const deleteTitle = isLast
    ? "An actor must have at least one expression"
    : usage > 0
      ? `Used in ${usage} scene${usage === 1 ? "" : "s"}`
      : "Remove expression";
  const showNameRequired = nameRequired && expression.name.trim().length === 0;

  useEffect(() => {
    if (!autoFocusName) return;
    const input = nameInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [autoFocusName, expression.id]);

  return (
    <div
      style={{
        border: "1px solid var(--app-border-subtle)",
        borderRadius: "6px",
        padding: "8px",
        marginBottom: "8px",
      }}
    >
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
          Name{isDefault ? " (default)" : ""}
          <input
            ref={nameInputRef}
            type="text"
            value={expression.name}
            placeholder="Expression name"
            onChange={(e) => onRename(e.target.value)}
            onBlur={() => {
              if (!onBlurRename()) {
                nameInputRef.current?.focus();
              }
            }}
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "4px 6px",
              boxSizing: "border-box",
              border: showNameRequired
                ? "1px solid var(--app-accent)"
                : "1px solid var(--app-border)",
              boxShadow: showNameRequired ? "0 0 0 2px var(--app-accent-subtle, rgba(59, 130, 246, 0.2))" : undefined,
              background: showNameRequired ? "var(--app-accent-soft, #e8f2ff)" : undefined,
            }}
          />
        </label>
        <div style={{ display: "flex", gap: "4px", flexShrink: 0, alignItems: "center" }}>
          <input
            type="radio"
            name={`default-expression-${asset.id}`}
            checked={isDefault}
            onChange={onSetDefault}
            title="Default expression"
            style={{ margin: 0, flexShrink: 0 }}
          />
          <ReplaceImageButton onClick={onReplace} title="Replace image…" />
          <CloseButton onClick={onRemove} disabled={!canDelete} title={deleteTitle} />
        </div>
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
  const addActorExpression = useProjectStore((s) => s.addActorExpression);
  const updateActorExpression = useProjectStore((s) => s.updateActorExpression);
  const replaceActorExpressionMedia = useProjectStore((s) => s.replaceActorExpressionMedia);
  const removeActorExpression = useProjectStore((s) => s.removeActorExpression);
  const flushHistoryCoalesce = useProjectStore((s) => s.flushHistoryCoalesce);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceExpressionRef = useRef<{ actorId: string; expressionId: string } | null>(null);
  const [expressionNameError, setExpressionNameError] = useState<string | null>(null);
  const [pendingExpressionId, setPendingExpressionId] = useState<string | null>(null);

  const asset = selectedAssetId
    ? project.assets.find((a) => a.id === selectedAssetId)
    : undefined;
  const sortedExpressions = useMemo(
    () => (asset?.type === "actor" ? getSortedActorExpressions(project, asset.id) : []),
    [project, asset]
  );
  const previewUrl = useAssetUrl(project, asset?.type === "actor" ? null : (asset?.id ?? null));

  useEffect(() => {
    setPendingExpressionId(null);
    setExpressionNameError(null);
  }, [selectedAssetId]);

  if (!asset) return null;

  const renamable = canRenameAsset(asset.id);
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

  const handleAddExpression = () => {
    if ((asset.expressions ?? []).some((entry) => entry.name.trim().length === 0)) {
      setExpressionNameError("Name the new expression before adding another");
      return;
    }
    try {
      const expression = addActorExpression(asset.id, "");
      setPendingExpressionId(expression.id);
      setExpressionNameError(null);
    } catch (error) {
      setExpressionNameError(error instanceof Error ? error.message : "Could not add expression");
    }
  };

  const commitExpressionName = (expression: ActorExpression): boolean => {
    if (expression.name.trim().length === 0) {
      setExpressionNameError("Expression name is required");
      setPendingExpressionId(expression.id);
      return false;
    }
    setExpressionNameError(null);
    if (pendingExpressionId === expression.id) {
      setPendingExpressionId(null);
    }
    flushHistoryCoalesce();
    return true;
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

      <InspectorPanelId id={asset.id} />

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

      <AssetDetailsUnderName asset={asset} isDefault={isDefault} />

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
            {sortedExpressions.map((expression) => (
              <ExpressionRow
                key={expression.id}
                asset={asset}
                expression={expression}
                isDefault={isDefaultExpression(asset, expression.id)}
                onSetDefault={() => {
                  if (isDefaultExpression(asset, expression.id)) return;
                  updateAsset(asset.id, { defaultExpressionId: expression.id });
                }}
                autoFocusName={pendingExpressionId === expression.id}
                nameRequired={pendingExpressionId === expression.id || expression.name.trim().length === 0}
                onReplace={() => triggerReplaceExpression(expression.id)}
                onRemove={() => {
                  try {
                    removeActorExpression(asset.id, expression.id);
                    setExpressionNameError(null);
                    if (pendingExpressionId === expression.id) {
                      setPendingExpressionId(null);
                    }
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
                onBlurRename={() => commitExpressionName(expression)}
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
    </div>
  );
}
