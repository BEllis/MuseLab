import type { AssetType, Project } from "../model/types";
import defaultBackdropDataUrl from "@/assets/default-backdrop.png?inline";
import {
  addActorExpression,
  addAsset,
  addAssetGroup,
} from "../model/project";
import { nextAssetTreeSortOrder } from "../model/assetTree";
import {
  normalizeExpressionName,
} from "../assets/actorExpressions";
import {
  findAssetIdByPath,
  formatAssetPath,
  normalizeSoundAssetName,
  splitAssetPath,
} from "./assetPath";
import type {
  MuseLabScriptDocument,
  MuseLabStoryScript,
} from "./types";
import { isProjectScript } from "./types";

export interface ScriptAssetReference {
  assetType: AssetType;
  assetPath: string;
  expressionName?: string;
}

function collectReferencesFromStory(script: MuseLabStoryScript): ScriptAssetReference[] {
  const references: ScriptAssetReference[] = [];
  for (const scene of script.scenes) {
    if (scene.backdrop?.backdrop_path) {
      references.push({
        assetType: "backdrop",
        assetPath: scene.backdrop.backdrop_path,
      });
    }
    if (scene.sound?.sound_path) {
      const { groupPath, assetName } = splitAssetPath(scene.sound.sound_path);
      references.push({
        assetType: "sound",
        assetPath: formatAssetPath(groupPath, normalizeSoundAssetName(assetName)),
      });
    }
    for (const actor of scene.actors ?? []) {
      references.push({
        assetType: "actor",
        assetPath: actor.actor_path,
        expressionName: actor.expression,
      });
    }
  }
  return references;
}

export function collectScriptAssetReferences(
  document: MuseLabScriptDocument
): ScriptAssetReference[] {
  if (isProjectScript(document)) {
    return document.stories.flatMap(collectReferencesFromStory);
  }
  return collectReferencesFromStory(document);
}

function ensureAssetGroupIdByPath(
  project: Project,
  assetType: AssetType,
  groupPath: string
): string | undefined {
  const segments = groupPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return undefined;

  if (!project.assetGroups) {
    project.assetGroups = [];
  }

  let parentGroupId: string | undefined;
  for (const segment of segments) {
    const matches = project.assetGroups.filter(
      (group) =>
        group.assetType === assetType &&
        group.name === segment &&
        group.parentGroupId === parentGroupId
    );
    if (matches.length === 1) {
      parentGroupId = matches[0].id;
      continue;
    }
    if (matches.length > 1) {
      throw new Error(`Ambiguous ${assetType} folder: "${segment}" in path "${groupPath}"`);
    }
    const created = addAssetGroup(project, assetType, segment, parentGroupId);
    parentGroupId = created.id;
  }
  return parentGroupId;
}

function createPlaceholderAsset(
  project: Project,
  assetType: AssetType,
  assetPath: string,
  groupId?: string
) {
  const { assetName } = splitAssetPath(assetPath);
  const trimmedName =
    assetType === "sound" ? normalizeSoundAssetName(assetName) : assetName.trim();

  const options = assetType === "backdrop" ? { url: defaultBackdropDataUrl } : {};
  const asset = addAsset(project, assetType, trimmedName, options);
  asset.groupId = groupId;
  asset.sortOrder = nextAssetTreeSortOrder(project, assetType, groupId);
  return asset;
}

function ensureActorExpression(
  project: Project,
  actorId: string,
  expressionName: string
): void {
  const actor = project.assets.find((entry) => entry.id === actorId && entry.type === "actor");
  if (!actor) return;

  const normalized = normalizeExpressionName(expressionName);
  if (!normalized) return;

  const existing = (actor.expressions ?? []).some(
    (expression) =>
      normalizeExpressionName(expression.name).toLowerCase() === normalized.toLowerCase()
  );
  if (existing) return;

  addActorExpression(project, actorId, normalized);
}

function referenceKey(reference: ScriptAssetReference): string {
  return `${reference.assetType}:${reference.assetPath}:${reference.expressionName ?? ""}`;
}

export function ensureScriptAssets(
  project: Project,
  references: ScriptAssetReference[]
): string[] {
  const notes: string[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    const key = referenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);

    let assetId = findAssetIdByPath(project, reference.assetType, reference.assetPath);
    if (!assetId) {
      const { groupPath } = splitAssetPath(reference.assetPath);
      const groupId = ensureAssetGroupIdByPath(project, reference.assetType, groupPath);
      createPlaceholderAsset(project, reference.assetType, reference.assetPath, groupId);
      assetId = findAssetIdByPath(project, reference.assetType, reference.assetPath);
      if (!assetId) {
        throw new Error(`Failed to create placeholder ${reference.assetType}: "${reference.assetPath}"`);
      }
      notes.push(`Added placeholder ${reference.assetType} "${reference.assetPath}"`);
    }

    if (reference.assetType !== "actor" || !reference.expressionName) {
      continue;
    }

    const actor = project.assets.find((entry) => entry.id === assetId);
    if (!actor) continue;

    const normalized = normalizeExpressionName(reference.expressionName).toLowerCase();
    const hasExpression = (actor.expressions ?? []).some(
      (expression) =>
        normalizeExpressionName(expression.name).toLowerCase() === normalized
    );
    if (hasExpression) continue;

    const expressions = actor.expressions ?? [];
    if (
      expressions.length === 1 &&
      normalizeExpressionName(expressions[0].name).toLowerCase() === "default" &&
      normalized !== "default"
    ) {
      expressions[0].name = normalizeExpressionName(reference.expressionName);
      notes.push(
        `Renamed default expression on "${reference.assetPath}" to "${reference.expressionName}"`
      );
      continue;
    }

    ensureActorExpression(project, assetId, reference.expressionName);
    notes.push(
      `Added placeholder expression "${reference.expressionName}" to actor "${reference.assetPath}"`
    );
  }

  return notes;
}
