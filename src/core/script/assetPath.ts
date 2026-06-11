import type { Asset, AssetType, Project } from "../model/types";

export function getAssetGroupPath(
  project: Project,
  groupId: string | undefined,
  assetType: AssetType
): string {
  if (!groupId) return "";
  const groups = project.assetGroups ?? [];
  const segments: string[] = [];
  let current: string | undefined = groupId;
  while (current) {
    const group = groups.find(
      (entry) => entry.id === current && entry.assetType === assetType
    );
    if (!group) break;
    segments.unshift(group.name);
    current = group.parentGroupId;
  }
  return segments.join("/");
}

export function formatAssetPath(groupPath: string, assetName: string): string {
  const trimmedName = assetName.trim();
  if (!groupPath.trim()) return trimmedName;
  return `${groupPath}/${trimmedName}`;
}

export function getAssetPath(project: Project, asset: Asset): string {
  const groupPath = getAssetGroupPath(project, asset.groupId, asset.type);
  return formatAssetPath(groupPath, asset.name);
}

function resolveGroupIdByPath(
  project: Project,
  assetType: AssetType,
  groupPath: string
): string | undefined {
  const segments = groupPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return undefined;

  let parentGroupId: string | undefined;
  for (const segment of segments) {
    const matches = (project.assetGroups ?? []).filter(
      (group) =>
        group.assetType === assetType &&
        group.name === segment &&
        group.parentGroupId === parentGroupId
    );
    if (matches.length !== 1) {
      const label = assetType === "actor" ? "Actor" : assetType === "backdrop" ? "Backdrop" : "Asset";
      throw new Error(
        matches.length === 0
          ? `${label} folder not found: "${groupPath}" (missing "${segment}")`
          : `Ambiguous ${label.toLowerCase()} folder: "${segment}" in path "${groupPath}"`
      );
    }
    parentGroupId = matches[0].id;
  }
  return parentGroupId;
}

export function splitAssetPath(assetPath: string): { groupPath: string; assetName: string } {
  const trimmed = assetPath.trim();
  if (!trimmed) {
    throw new Error("Asset path must not be empty");
  }
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash < 0) {
    return { groupPath: "", assetName: trimmed };
  }
  return {
    groupPath: trimmed.slice(0, lastSlash),
    assetName: trimmed.slice(lastSlash + 1).trim(),
  };
}

function assetTypeLabel(assetType: AssetType): string {
  switch (assetType) {
    case "actor":
      return "Actor";
    case "backdrop":
      return "Backdrop";
    case "sound":
      return "Sound clip";
    case "font":
      return "Font";
    default:
      return "Asset";
  }
}

export function resolveAssetIdByPath(
  project: Project,
  assetType: AssetType,
  assetPath: string
): string {
  const { groupPath, assetName } = splitAssetPath(assetPath);
  const trimmedName = assetName.trim();
  if (!trimmedName) {
    throw new Error(`${assetTypeLabel(assetType)} path must include an asset name`);
  }

  const parentGroupId = resolveGroupIdByPath(project, assetType, groupPath);
  const matches = project.assets.filter(
    (asset) =>
      asset.type === assetType &&
      asset.name === trimmedName &&
      asset.groupId === parentGroupId
  );

  if (matches.length === 0) {
    throw new Error(`${assetTypeLabel(assetType)} not found: "${assetPath}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous ${assetTypeLabel(assetType).toLowerCase()} name: "${trimmedName}" in "${assetPath}"`);
  }
  return matches[0].id;
}

export function resolveAssetById(project: Project, assetId: string): Asset {
  const asset = project.assets.find((entry) => entry.id === assetId);
  if (!asset) {
    throw new Error(`Asset not found: "${assetId}"`);
  }
  return asset;
}

export function findAssetIdByPath(
  project: Project,
  assetType: AssetType,
  assetPath: string
): string | null {
  try {
    return resolveAssetIdByPath(project, assetType, assetPath);
  } catch {
    return null;
  }
}

/** Strip common audio extensions when resolving sound paths from script files. */
export function normalizeSoundAssetName(name: string): string {
  return name.replace(/\.(wav|mp3|ogg|m4a|flac)$/i, "").trim();
}
