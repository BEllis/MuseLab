import { useRef, useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { AssetType } from "@/core/model/types";
import type { Project } from "@/core/model/types";
import { getAssetUrlAsync } from "@/core/assets/resolver";
import { setAssetDragData, type AssetDragKind } from "@/utils/dragDrop";
import { AddButton } from "./AddButton";
import { CloseButton } from "./CloseButton";

const THUMB_SIZE = 40;

function EditableName({
  name,
  onSave,
  style,
  title,
}: {
  name: string;
  onSave: (newName: string) => void;
  style?: React.CSSProperties;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) onSave(trimmed);
    setEditing(false);
    setValue(name);
  }, [name, value, onSave]);

  const cancel = useCallback(() => {
    setEditing(false);
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) setValue(name);
  }, [editing, name]);

  if (editing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        autoFocus
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "12px",
          padding: "2px 4px",
          border: "1px solid #4a90d9",
          borderRadius: "4px",
          outline: "none",
        }}
      />
    );
  }
  return (
    <span
      style={{
        flex: 1,
        fontSize: "12px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "text",
        ...style,
      }}
      title={title ?? name}
      onDoubleClick={(e) => {
        e.preventDefault();
        setEditing(true);
      }}
    >
      {name}
    </span>
  );
}

function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
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
  const updateAsset = useProjectStore((s) => s.updateAsset);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);

  const addFiles = (files: File[], type?: AssetType) => {
    files.forEach((file) => {
      const assetType = type ?? inferType(file);
      if (!assetType) return;
      const url = URL.createObjectURL(file);
      addAsset(assetType, file.name, { url });
    });
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
      input.onchange = () => {
        const files = input.files;
        if (!files) return;
        Array.from(files).forEach((file) => {
          const url = URL.createObjectURL(file);
          addAsset(type, file.name, { url });
        });
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    if (isElectron()) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    addFiles(files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isElectron()) return;
    setDropActive(true);
  };

  const onDragLeave = () => setDropActive(false);

  return (
    <div
      style={{
        width: "240px",
        borderRight: "1px solid #ccc",
        padding: "12px",
        background: dropActive ? "#e0e8ff" : "#f0f0f0",
        overflowY: "auto",
      }}
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
      <h3 style={{ margin: "0 0 12px", fontSize: "14px" }}>Assets</h3>
      <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#666" }}>
        Drop images (backdrop) or audio (sound) here to add.
      </p>

      <Section
        title="Backdrops"
        items={backdrops}
        project={project}
        showThumbnails
        draggableAssetType="backdrop"
        onAdd={() => triggerFileInput("backdrop", false)}
        onRename={updateAsset}
        onRemove={removeAsset}
        addLabel="Add backdrop"
      />
      <Section
        title="Actors"
        items={actors}
        project={project}
        showThumbnails
        draggableAssetType="actor"
        onAdd={() => triggerFileInput("actor", false)}
        onRename={updateAsset}
        onRemove={removeAsset}
        addLabel="Add actor"
      />
      <Section
        title="Sounds"
        items={sounds}
        onAdd={() => triggerFileInput("sound", false)}
        onRename={updateAsset}
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
  onRename,
  onRemove,
  dragType,
}: {
  project: Project;
  assetId: string;
  name: string;
  onRename: (newName: string) => void;
  onRemove: () => void;
  dragType?: AssetDragKind;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;

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
  }, [assetId]);

  const handleImgError = useCallback(() => setError(true), []);

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      if (dragType) setAssetDragData(e.dataTransfer, { type: dragType, assetId });
    },
    [dragType, assetId]
  );

  return (
    <li
      draggable={!!dragType}
      onDragStart={dragType ? onDragStart : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "6px",
        cursor: dragType ? "grab" : undefined,
      }}
    >
      <div
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          flexShrink: 0,
          borderRadius: "4px",
          overflow: "hidden",
          background: "#ddd",
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
          <span style={{ fontSize: "10px", color: "#888" }}>…</span>
        )}
      </div>
      <EditableName
        name={name}
        onSave={onRename}
        title={name}
      />
      <CloseButton onClick={onRemove} title="Remove" />
    </li>
  );
}

function Section({
  title,
  items,
  onAdd,
  onRename,
  onRemove,
  addLabel = "Add",
  project,
  showThumbnails = false,
  draggableAssetType,
}: {
  title: string;
  items: { id: string; name: string }[];
  onAdd: () => void;
  onRename?: (assetId: string, patch: { name: string }) => void;
  onRemove: (id: string) => void;
  addLabel?: string;
  project?: Project;
  showThumbnails?: boolean;
  draggableAssetType?: AssetDragKind;
}) {
  const onDragStartPlain = useCallback(
    (e: React.DragEvent, assetId: string) => {
      if (draggableAssetType) setAssetDragData(e.dataTransfer, { type: draggableAssetType, assetId });
    },
    [draggableAssetType]
  );

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
                onRename={(newName) => onRename?.(a.id, { name: newName })}
                onRemove={() => onRemove(a.id)}
                dragType={draggableAssetType}
              />
            ))
          : items.map((a) => (
              <li
                key={a.id}
                draggable={!!draggableAssetType}
                onDragStart={draggableAssetType ? (e) => onDragStartPlain(e, a.id) : undefined}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "4px",
                  marginBottom: "4px",
                  cursor: draggableAssetType ? "grab" : undefined,
                }}
              >
                {onRename ? (
                  <EditableName
                    name={a.name}
                    onSave={(newName) => onRename(a.id, { name: newName })}
                    style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                  />
                ) : (
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                )}
                <CloseButton onClick={() => onRemove(a.id)} title="Remove" />
              </li>
            ))}
      </ul>
    </div>
  );
}
