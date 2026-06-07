/** MIME type for asset drag from Assets panel to Node editor */
export const ASSET_DRAG_TYPE = "application/x-muselab-asset";

export type AssetDragKind = "backdrop" | "actor" | "sound";

export interface AssetDragData {
  type: AssetDragKind;
  assetId: string;
}

export function setAssetDragData(dataTransfer: DataTransfer, data: AssetDragData): void {
  dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(data));
  dataTransfer.effectAllowed = "copy";
}

export function getAssetDragData(dataTransfer: DataTransfer): AssetDragData | null {
  const raw = dataTransfer.getData(ASSET_DRAG_TYPE);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as AssetDragData;
    if (data.type !== "backdrop" && data.type !== "actor" && data.type !== "sound") return null;
    if (typeof data.assetId !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export function isAssetDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(ASSET_DRAG_TYPE);
}
