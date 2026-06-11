import { isDefaultBackdrop } from "./defaultBackdrop";
import { isDefaultFont } from "./defaultFont";

export function canRemoveAsset(assetId: string): boolean {
  return !isDefaultBackdrop(assetId) && !isDefaultFont(assetId);
}

export function canRenameAsset(assetId: string): boolean {
  return !isDefaultBackdrop(assetId) && !isDefaultFont(assetId);
}

export function canReplaceAsset(_assetId: string): boolean {
  return true;
}
