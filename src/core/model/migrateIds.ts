import type { LocalePrompts, Project } from "./types";
import type { PromptsByLocale } from "../locale/prompts";
import { expressionBlobKey } from "../assets/actorExpressions";
import { generateId, isObjectId, isReservedObjectId } from "./id";

export type BlobKeyRemapping = { from: string; to: string };

export type IdMigrationResult = {
  migrated: boolean;
  blobKeyRemappings: BlobKeyRemapping[];
};

function needsMigration(id: string): boolean {
  return !isObjectId(id);
}

function remap(id: string | undefined, map: Map<string, string>): string | undefined {
  if (id == null) return id;
  return map.get(id) ?? id;
}

function replaceIdSegment(path: string, oldId: string, newId: string): string {
  if (!path.includes(oldId)) return path;
  return path.split(oldId).join(newId);
}

function collectMigratableIds(project: Project): Set<string> {
  const ids = new Set<string>();

  for (const story of project.stories) {
    if (needsMigration(story.id)) ids.add(story.id);
    if (story.entryNodeId && needsMigration(story.entryNodeId)) ids.add(story.entryNodeId);

    for (const node of story.nodes) {
      if (needsMigration(node.id)) ids.add(node.id);
      if (node.backdropId && needsMigration(node.backdropId)) ids.add(node.backdropId);
      if (node.jumpTargetStoryId && needsMigration(node.jumpTargetStoryId)) {
        ids.add(node.jumpTargetStoryId);
      }
      if (node.jumpTargetStartNodeId && needsMigration(node.jumpTargetStartNodeId)) {
        ids.add(node.jumpTargetStartNodeId);
      }
      for (const config of node.actorConfigs ?? []) {
        if (needsMigration(config.assetId)) ids.add(config.assetId);
        if (needsMigration(config.expressionId)) ids.add(config.expressionId);
      }
      for (const config of node.soundConfigs ?? []) {
        if (needsMigration(config.assetId)) ids.add(config.assetId);
      }
    }

    for (const edge of story.edges) {
      if (needsMigration(edge.id)) ids.add(edge.id);
      if (needsMigration(edge.sourceNodeId)) ids.add(edge.sourceNodeId);
      if (needsMigration(edge.targetNodeId)) ids.add(edge.targetNodeId);
    }
  }

  for (const asset of project.assets) {
    if (needsMigration(asset.id)) ids.add(asset.id);
    for (const expression of asset.expressions ?? []) {
      if (needsMigration(expression.id)) ids.add(expression.id);
    }
  }

  for (const service of project.services ?? []) {
    if (needsMigration(service.id)) ids.add(service.id);
  }

  return ids;
}

function buildIdMap(ids: Set<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const oldId of ids) {
    map.set(oldId, generateId());
  }
  return map;
}

function collectBlobKeyRemappings(
  project: Project,
  idMap: Map<string, string>
): BlobKeyRemapping[] {
  const remappings: BlobKeyRemapping[] = [];
  const seen = new Set<string>();

  function add(from: string, to: string): void {
    if (from === to || seen.has(from)) return;
    seen.add(from);
    remappings.push({ from, to });
  }

  for (const asset of project.assets) {
    const newAssetId = idMap.get(asset.id);
    if (!newAssetId) continue;

    add(asset.id, newAssetId);

    if (asset.type === "actor") {
      for (const expression of asset.expressions ?? []) {
        const newExpressionId = idMap.get(expression.id) ?? expression.id;
        add(
          expressionBlobKey(asset.id, expression.id),
          expressionBlobKey(newAssetId, newExpressionId)
        );
      }
    }
  }

  return remappings;
}

function applyIdMapToProject(project: Project, idMap: Map<string, string>): void {
  for (const story of project.stories) {
    story.id = remap(story.id, idMap) ?? story.id;
    story.entryNodeId = remap(story.entryNodeId, idMap);

    for (const node of story.nodes) {
      node.id = remap(node.id, idMap) ?? node.id;
      if (node.backdropId) {
        node.backdropId = remap(node.backdropId, idMap) ?? node.backdropId;
      }
      if (node.jumpTargetStoryId) {
        node.jumpTargetStoryId = remap(node.jumpTargetStoryId, idMap) ?? node.jumpTargetStoryId;
      }
      if (node.jumpTargetStartNodeId) {
        node.jumpTargetStartNodeId =
          remap(node.jumpTargetStartNodeId, idMap) ?? node.jumpTargetStartNodeId;
      }
      for (const config of node.actorConfigs ?? []) {
        config.assetId = remap(config.assetId, idMap) ?? config.assetId;
        config.expressionId = remap(config.expressionId, idMap) ?? config.expressionId;
      }
      for (const config of node.soundConfigs ?? []) {
        config.assetId = remap(config.assetId, idMap) ?? config.assetId;
      }
    }

    for (const edge of story.edges) {
      const oldEdgeId = edge.id;
      edge.id = remap(edge.id, idMap) ?? edge.id;
      edge.sourceNodeId = remap(edge.sourceNodeId, idMap) ?? edge.sourceNodeId;
      edge.targetNodeId = remap(edge.targetNodeId, idMap) ?? edge.targetNodeId;
      if (edge.sourcePortId?.startsWith("out-")) {
        const portEdgeId = edge.sourcePortId.slice(4);
        const newPortEdgeId = remap(portEdgeId, idMap) ?? portEdgeId;
        edge.sourcePortId = `out-${newPortEdgeId}`;
      } else if (oldEdgeId !== edge.id && edge.sourcePortId === `out-${oldEdgeId}`) {
        edge.sourcePortId = `out-${edge.id}`;
      }
    }
  }

  for (const asset of project.assets) {
    const oldAssetId = asset.id;
    asset.id = remap(asset.id, idMap) ?? asset.id;

    if (asset.path && oldAssetId !== asset.id) {
      asset.path = replaceIdSegment(asset.path, oldAssetId, asset.id);
    }

    for (const expression of asset.expressions ?? []) {
      const oldExpressionId = expression.id;
      expression.id = remap(expression.id, idMap) ?? expression.id;
      if (expression.path && oldExpressionId !== expression.id) {
        expression.path = replaceIdSegment(expression.path, oldExpressionId, expression.id);
        if (oldAssetId !== asset.id) {
          expression.path = replaceIdSegment(expression.path, oldAssetId, asset.id);
        }
      }
    }
  }

  for (const service of project.services ?? []) {
    if (!isReservedObjectId(service.id)) {
      service.id = remap(service.id, idMap) ?? service.id;
    }
  }
}

function remapRecordKeys<T>(
  record: Record<string, T>,
  idMap: Map<string, string>
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    next[idMap.get(key) ?? key] = value;
  }
  return next;
}

function applyIdMapToPrompts(promptsByLocale: PromptsByLocale, idMap: Map<string, string>): void {
  for (const localePrompts of Object.values(promptsByLocale)) {
    const nextStories: LocalePrompts["stories"] = {};
    for (const [storyId, storyPrompts] of Object.entries(localePrompts.stories)) {
      const newStoryId = idMap.get(storyId) ?? storyId;
      nextStories[newStoryId] = {
        nodes: remapRecordKeys(storyPrompts.nodes, idMap),
        edges: remapRecordKeys(storyPrompts.edges, idMap),
      };
    }
    localePrompts.stories = nextStories;
  }
}

/** Migrate legacy non-UUID object ids to UUIDs. Reserved built-in ids are unchanged. */
export function migrateProjectIdsToUuid(
  project: Project,
  promptsByLocale: PromptsByLocale
): IdMigrationResult {
  const migratableIds = collectMigratableIds(project);
  if (migratableIds.size === 0) {
    return { migrated: false, blobKeyRemappings: [] };
  }

  const idMap = buildIdMap(migratableIds);
  const blobKeyRemappings = collectBlobKeyRemappings(project, idMap);

  applyIdMapToProject(project, idMap);
  applyIdMapToPrompts(promptsByLocale, idMap);

  return { migrated: true, blobKeyRemappings };
}
