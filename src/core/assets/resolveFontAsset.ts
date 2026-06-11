import type { Project } from "../model/types";

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
        group.assetType === "font" &&
        group.name === segment &&
        group.parentGroupId === parentGroupId
    );
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? `Font folder not found: "${groupPath}" (missing "${segment}")`
          : `Ambiguous font folder: "${segment}" in path "${groupPath}"`
      );
    }
    parentGroupId = matches[0].id;
  }
  return parentGroupId;
}

export function resolveFontAssetId(
  project: Project,
  groupPath: string,
  assetName: string
): string {
  const trimmedName = assetName.trim();
  if (!trimmedName) {
    throw new Error("Font asset name must not be empty");
  }

  const parentGroupId = resolveGroupIdByPath(project, groupPath);
  const matches = project.assets.filter(
    (asset) =>
      asset.type === "font" &&
      asset.name === trimmedName &&
      asset.groupId === parentGroupId
  );

  if (matches.length === 0) {
    throw new Error(`Font not found: "${groupPath}/${trimmedName}"`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous font name: "${trimmedName}" in "${groupPath}"`);
  }
  return matches[0].id;
}
