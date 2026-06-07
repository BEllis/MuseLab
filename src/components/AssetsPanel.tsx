import { useRef, useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { AssetType } from "@/core/model/types";
import type { Project } from "@/core/model/types";
import { getAssetUrlAsync } from "@/core/assets/resolver";
import { setAssetDragData, type AssetDragKind } from "@/utils/dragDrop";
import { isElectron } from "@/utils/isElectron";
import { canRemoveAsset } from "@/core/assets/defaultBackdrop";
import { AddButton } from "./AddButton";
import { CloseButton } from "./CloseButton";

const THUMB_SIZE = 40;

function useAssetRowSelection(onSelect: () => void) {
  const dragStartedRef = useRef(false);

  const onDragStart = useCallback(() => {
    dragStartedRef.current = true;
  }, []);

  const onDragEnd = useCallback(() => {
    window.setTimeout(() => {
      dragStartedRef.current = false;
    }, 0);
  }, []);

  const onClick = useCallback(() => {
    if (dragStartedRef.current) return;
    onSelect();
  }, [onSelect]);

  return { onDragStart, onDragEnd, onClick };
}

function selectedRowStyle(selected: boolean): React.CSSProperties {
  return selected
    ? {
        background: "var(--app-accent-subtle, rgba(59, 130, 246, 0.12))",
        outline: "1px solid var(--app-accent)",
        borderRadius: "6px",
      }
    : {};
}

function inferType(file: File): AssetType | null {
  const t = file.type;
  if (t.startsWith("image/")) return "backdrop";
  if (t.startsWith("audio/")) return "sound";
  return null;
}

export function AssetsPanel() {
  const project = useProjectStore((s) => s.project);
  const addAsset = useProjectStore((s) => s.addAsset);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const selectedAssetId = useProjectStore((s) => s.selectedAssetId);
  const setSelectedAssetId = useProjectStore((s) => s.setSelectedAssetId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);

  const addFiles = async (files: File[], type?: AssetType) => {
    for (const file of files) {
      const assetType = type ?? inferType(file);
      if (!assetType) continue;
      await addAsset(assetType, file.name, { file });
    }
  };

  const triggerFileInput = (type: AssetType, multiple: boolean) => {
    if (isElectron() && window.electronAPI?.openFileDialog) {
      window.electronAPI.openFileDialog({ type, multiple }).then((paths) => {
        paths.forEach((filePath) => {
          const name = filePath.split(/[/\\]/).pop() ?? "Asset";
          addAsset(type, name, { path: filePath });
        });
      });
    } else {
      const input = fileInputRef.current;
      if (!input) return;
      input.accept =
        type === "sound"
          ? "audio/mpeg,audio/wav,audio/ogg,audio/mp4"
          : "image/png,image/jpeg,image/gif,image/webp";
      input.multiple = multiple;
      input.onchange = async () => {
        const files = input.files;
        if (!files) return;
        for (const file of Array.from(files)) {
          await addAsset(type, file.name, { file });
        }
        input.value = "";
      };
      input.click();
    }
  };

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const backdrops = project.assets.filter((a) => a.type === "backdrop").sort(byName);
  const actors = project.assets.filter((a) => a.type === "actor").sort(byName);
  const sounds = project.assets.filter((a) => a.type === "sound").sort(byName);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    if (isElectron()) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    await addFiles(files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isElectron()) return;
    setDropActive(true);
  };

  const onDragLeave = () => setDropActive(false);

  return (
    <div
      className={dropActive ? "app-assets-panel is-drop-active" : "app-assets-panel"}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept="image/*,audio/*"
      />
      <p style={{ margin: "0 0 12px", fontSize: "11px", color: "var(--app-text-muted)" }}>
        Drop images (backdrop) or audio (sound) here to add.
      </p>

      <Section
        title="Backdrops"
        items={backdrops}
        project={project}
        showThumbnails
        draggableAssetType="backdrop"
        selectedAssetId={selectedAssetId}
        onSelectAsset={setSelectedAssetId}
        onAdd={() => triggerFileInput("backdrop", false)}
        onRemove={removeAsset}
        addLabel="Add backdrop"
      />
      <Section
        title="Actors"
        items={actors}
        project={project}
        showThumbnails
        draggableAssetType="actor"
        selectedAssetId={selectedAssetId}
        onSelectAsset={setSelectedAssetId}
        onAdd={() => triggerFileInput("actor", false)}
        onRemove={removeAsset}
        addLabel="Add actor"
      />
      <Section
        title="Sounds"
        items={sounds}
        selectedAssetId={selectedAssetId}
        onSelectAsset={setSelectedAssetId}
        draggableAssetType="sound"
        onAdd={() => triggerFileInput("sound", false)}
        onRemove={removeAsset}
        addLabel="Add sound"
      />
    </div>
  );
}

function AssetThumbnailRow({
  project,
  assetId,
  name,
  selected,
  onSelect,
  onRemove,
  dragType,
  removable = true,
}: {
  project: Project;
  assetId: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  dragType?: AssetDragKind;
  removable?: boolean;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const selection = useAssetRowSelection(onSelect);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setThumbUrl(null);
    const proj = projectRef.current;
    getAssetUrlAsync(proj, assetId)
      .then((url) => {
        if (!cancelled && url) setThumbUrl(url);
        if (!cancelled && !url) setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, project]);

  const handleImgError = useCallback(() => setError(true), []);

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      selection.onDragStart();
      if (dragType) setAssetDragData(e.dataTransfer, { type: dragType, assetId });
    },
    [dragType, assetId, selection]
  );

  return (
    <li
      draggable={!!dragType}
      onClick={selection.onClick}
      onDragStart={dragType ? onDragStart : undefined}
      onDragEnd={dragType ? selection.onDragEnd : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "6px",
        padding: "4px",
        cursor: dragType ? "grab" : "pointer",
        ...selectedRowStyle(selected),
      }}
    >
      <div
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          flexShrink: 0,
          borderRadius: "4px",
          overflow: "hidden",
          background: "var(--app-border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {thumbUrl && !error ? (
          <img
            src={thumbUrl}
            alt=""
            onError={handleImgError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span style={{ fontSize: "10px", color: "var(--app-text-subtle)" }}>…</span>
        )}
      </div>
      <span
        style={{
          flex: 1,
          fontSize: "12px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={name}
      >
        {name}
      </span>
      {removable && (
        <span
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <CloseButton onClick={onRemove} title="Remove" />
        </span>
      )}
    </li>
  );
}

function PlainAssetRow({
  assetId,
  name,
  selected,
  onSelect,
  onRemove,
  draggableAssetType,
}: {
  assetId: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  draggableAssetType?: AssetDragKind;
}) {
  const selection = useAssetRowSelection(onSelect);

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      selection.onDragStart();
      if (draggableAssetType) {
        setAssetDragData(e.dataTransfer, { type: draggableAssetType, assetId });
      }
    },
    [assetId, draggableAssetType, selection]
  );

  return (
    <li
      draggable={!!draggableAssetType}
      onClick={selection.onClick}
      onDragStart={draggableAssetType ? onDragStart : undefined}
      onDragEnd={draggableAssetType ? selection.onDragEnd : undefined}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "4px",
        marginBottom: "4px",
        padding: "4px 6px",
        cursor: draggableAssetType ? "grab" : "pointer",
        ...selectedRowStyle(selected),
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      {canRemoveAsset(assetId) && (
        <span
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <CloseButton onClick={onRemove} title="Remove" />
        </span>
      )}
    </li>
  );
}

function Section({
  title,
  items,
  onAdd,
  onRemove,
  addLabel = "Add",
  project,
  showThumbnails = false,
  draggableAssetType,
  selectedAssetId,
  onSelectAsset,
}: {
  title: string;
  items: { id: string; name: string }[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel?: string;
  project?: Project;
  showThumbnails?: boolean;
  draggableAssetType?: AssetDragKind;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <strong style={{ fontSize: "12px" }}>{title}</strong>
        <AddButton onClick={onAdd} title={addLabel} />
      </div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: "12px" }}>
        {showThumbnails && project
          ? items.map((a) => (
              <AssetThumbnailRow
                key={a.id}
                project={project}
                assetId={a.id}
                name={a.name}
                selected={selectedAssetId === a.id}
                onSelect={() => onSelectAsset(a.id)}
                onRemove={() => onRemove(a.id)}
                dragType={draggableAssetType}
                removable={canRemoveAsset(a.id)}
              />
            ))
          : items.map((a) => (
              <PlainAssetRow
                key={a.id}
                assetId={a.id}
                name={a.name}
                selected={selectedAssetId === a.id}
                onSelect={() => onSelectAsset(a.id)}
                onRemove={() => onRemove(a.id)}
                draggableAssetType={draggableAssetType}
              />
            ))}
      </ul>
    </div>
  );
}
