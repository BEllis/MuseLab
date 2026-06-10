import { useState } from "react";
import { AssetTreeView } from "./AssetTreeView";
import { useProjectStore } from "@/store/projectStore";
import type { AssetType } from "@/core/model/types";
import { isElectron } from "@/utils/isElectron";

function inferType(file: File): AssetType | null {
  const t = file.type;
  if (t.startsWith("image/")) return "backdrop";
  if (t.startsWith("audio/")) return "sound";
  return null;
}

export function AssetsPanel() {
  const addAsset = useProjectStore((s) => s.addAsset);
  const [dropActive, setDropActive] = useState(false);

  const addFiles = async (files: File[], type?: AssetType) => {
    for (const file of files) {
      const assetType = type ?? inferType(file);
      if (!assetType) continue;
      await addAsset(assetType, file.name, { file });
    }
  };

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
      <p style={{ margin: "0 0 8px", fontSize: "11px", color: "var(--app-text-muted)" }}>
        Drop images (backdrop) or audio (sound clip) here to add.
      </p>
      <AssetTreeView />
    </div>
  );
}
