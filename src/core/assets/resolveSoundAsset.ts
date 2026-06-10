import type { Project } from "@/core/model/types";

function resolveGroupIdByPath(
  project: Project,
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
        group.assetType === "sound" &&
        group.name === segment &&
        group.parentGroupId === parentGroupId
    );
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? `Sound folder not found: "${groupPath}" (missing "${segment}")`
          : `Ambiguous sound folder: "${segment}" in path "${groupPath}"`
      );
    }
    parentGroupId = matches[0].id;
  }
  return parentGroupId;
}

export function resolveSoundAssetId(
  project: Project,
  groupPath: string,
  assetName: string
): string {
  const trimmedName = assetName.trim();
  if (!trimmedName) {
    throw new Error("Sound asset name must not be empty");
  }

  const parentGroupId = resolveGroupIdByPath(project, groupPath);
  const matches = project.assets.filter(
    (asset) =>
      asset.type === "sound" &&
      asset.name === trimmedName &&
      asset.groupId === parentGroupId
  );

  if (matches.length === 0) {
    throw new Error(`Sound clip not found: "${groupPath}/${trimmedName}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous sound clip name: "${trimmedName}" in "${groupPath}"`);
  }
  return matches[0].id;
}

export function resolveSoundAssetIdById(project: Project, assetId: string): string {
  const asset = project.assets.find((entry) => entry.id === assetId);
  if (!asset) {
    throw new Error(`Sound asset not found: "${assetId}"`);
  }
  if (asset.type !== "sound") {
    throw new Error(`Asset "${assetId}" is not a sound clip`);
  }
  return asset.id;
}
