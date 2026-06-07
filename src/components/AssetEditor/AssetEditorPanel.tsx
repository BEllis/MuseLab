import { useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { Asset, AssetType } from "@/core/model/types";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { getAssetUsage } from "@/core/assets/assetUsage";
import { canRemoveAsset, canRenameAsset, canReplaceAsset, isDefaultBackdrop } from "@/core/assets/defaultBackdrop";
import { CloseButton } from "../CloseButton";
import { isElectron } from "@/utils/isElectron";

const PANEL_STYLE: React.CSSProperties = {
  width: "320px",
  borderLeft: "1px solid var(--app-border)",
  padding: "12px",
  background: "var(--app-surface-muted)",
  overflowY: "auto",
  maxHeight: "100vh",
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
      Used in {parts.join(", ")}. Replacing media updates all references automatically.
    </p>
  );
}

export function AssetEditorPanel() {
  const selectedAssetId = useProjectStore((s) => s.selectedAssetId);
  const project = useProjectStore((s) => s.project);
  const setSelectedAssetId = useProjectStore((s) => s.setSelectedAssetId);
  const updateAsset = useProjectStore((s) => s.updateAsset);
  const replaceAssetMedia = useProjectStore((s) => s.replaceAssetMedia);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const asset = selectedAssetId
    ? project.assets.find((a) => a.id === selectedAssetId)
    : undefined;
  const previewUrl = useAssetUrl(project, asset?.id ?? null);

  if (!asset) return null;

  const renamable = canRenameAsset(asset.id);
  const removable = canRemoveAsset(asset.id);
  const replaceable = canReplaceAsset(asset.id);
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

  const handleRemove = async () => {
    await removeAsset(asset.id);
    setSelectedAssetId(null);
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
          onChange={(e) => updateAsset(asset.id, { name: e.target.value })}
          style={{
            display: "block",
            width: "100%",
            marginTop: "4px",
            padding: "6px",
            opacity: renamable ? 1 : 0.7,
          }}
        />
      </label>

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
