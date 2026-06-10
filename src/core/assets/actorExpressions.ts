import type { ActorExpression, Asset, Project, StoryNode } from "../model/types";
import { generateId } from "../model/id";
import expressionPlaceholderDataUrl from "@/assets/expression-placeholder.png?inline";

export const DEFAULT_EXPRESSION_NAME = "default";
export const PLACEHOLDER_EXPRESSION_URL = expressionPlaceholderDataUrl;

export function expressionBlobKey(actorId: string, expressionId: string): string {
  return `${actorId}:${expressionId}`;
}

export function expressionArchivePath(actorId: string, expressionId: string, ext: string): string {
  const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `assets/actors/${actorId}/${expressionId}${normalizedExt}`;
}

export function normalizeExpressionName(name: string): string {
  return name.trim();
}

export function isExpressionNameUnique(
  actor: Asset,
  name: string,
  excludeId?: string
): boolean {
  const normalized = normalizeExpressionName(name).toLowerCase();
  if (!normalized) return false;
  const expressions = actor.expressions ?? [];
  return !expressions.some(
    (expr) =>
      expr.id !== excludeId && normalizeExpressionName(expr.name).toLowerCase() === normalized
  );
}

export function findExpression(actor: Asset, expressionId: string): ActorExpression | undefined {
  return actor.expressions?.find((expr) => expr.id === expressionId);
}

export function getDefaultExpressionId(actor: Asset): string {
  const expressions = actor.expressions ?? [];
  if (expressions.length === 0) {
    throw new Error(`Actor ${actor.id} has no expressions`);
  }
  if (actor.defaultExpressionId) {
    const explicit = findExpression(actor, actor.defaultExpressionId);
    if (explicit) return explicit.id;
  }
  const namedDefault = expressions.find(
    (expr) => normalizeExpressionName(expr.name).toLowerCase() === DEFAULT_EXPRESSION_NAME
  );
  if (namedDefault) return namedDefault.id;
  return expressions[0].id;
}

export function isDefaultExpression(actor: Asset, expressionId: string): boolean {
  return getDefaultExpressionId(actor) === expressionId;
}

export function resolveExpression(actor: Asset, expressionId?: string): ActorExpression {
  if (expressionId) {
    const found = findExpression(actor, expressionId);
    if (found) return found;
  }
  const expressions = actor.expressions ?? [];
  if (expressions.length === 0) {
    throw new Error(`Actor ${actor.id} has no expressions`);
  }
  return expressions[0];
}

export interface ExpressionMediaOptions {
  path?: string;
  url?: string;
  imageData?: string;
  imageMimeType?: string;
  blobStored?: boolean;
}

export function createExpression(
  name: string,
  media: ExpressionMediaOptions = {}
): ActorExpression {
  const expression: ActorExpression = {
    id: generateId(),
    name: normalizeExpressionName(name) || DEFAULT_EXPRESSION_NAME,
  };

  if (media.path) expression.path = media.path;
  if (media.url) expression.url = media.url;
  if (media.imageData) expression.imageData = media.imageData;
  if (media.imageMimeType) expression.imageMimeType = media.imageMimeType;
  if (media.blobStored) expression.blobStored = true;

  if (!expression.path && !expression.url && !expression.imageData && !expression.blobStored) {
    expression.url = PLACEHOLDER_EXPRESSION_URL;
  }

  return expression;
}

/** Placeholder expression awaiting a user-provided name in the editor. */
export function createBlankExpression(): ActorExpression {
  return {
    id: generateId(),
    name: "",
    url: PLACEHOLDER_EXPRESSION_URL,
  };
}

function stripActorLevelMedia(asset: Asset): ExpressionMediaOptions {
  const media: ExpressionMediaOptions = {};
  if (asset.path) media.path = asset.path;
  if (asset.url) media.url = asset.url;
  if (asset.imageData) media.imageData = asset.imageData;
  if (asset.imageMimeType) media.imageMimeType = asset.imageMimeType;
  if (asset.blobStored) media.blobStored = true;

  delete asset.path;
  delete asset.url;
  delete asset.imageData;
  delete asset.imageMimeType;
  delete asset.blobStored;

  return media;
}

function hasMedia(media: ExpressionMediaOptions): boolean {
  return Boolean(
    media.path || media.url || media.imageData || media.blobStored
  );
}

/** Migrate legacy single-image actors to expressions and ensure at least one expression. */
export function ensureActorExpressions(asset: Asset): void {
  if (asset.type !== "actor") return;

  if (asset.expressions && asset.expressions.length > 0) {
    stripActorLevelMedia(asset);
    return;
  }

  const legacyMedia = stripActorLevelMedia(asset);
  if (hasMedia(legacyMedia)) {
    asset.expressions = [createExpression(DEFAULT_EXPRESSION_NAME, legacyMedia)];
    asset.defaultExpressionId = asset.expressions[0].id;
    return;
  }

  asset.expressions = [createExpression(DEFAULT_EXPRESSION_NAME)];
  asset.defaultExpressionId = asset.expressions[0].id;
}

export function ensureAllActorExpressions(project: Project): void {
  for (const asset of project.assets) {
    ensureActorExpressions(asset);
  }
}

export function getExpressionUsage(
  project: Project,
  actorId: string,
  expressionId: string
): number {
  let count = 0;
  for (const story of project.stories) {
    for (const node of story.nodes) {
      for (const config of node.actorConfigs ?? []) {
        if (config.assetId === actorId && config.expressionId === expressionId) {
          count += 1;
        }
      }
    }
  }
  return count;
}

export function collectExpressionBlobKeys(project: Project): Set<string> {
  const keys = new Set<string>();
  for (const asset of project.assets) {
    if (asset.type !== "actor") continue;
    for (const expression of asset.expressions ?? []) {
      if (expression.blobStored) {
        keys.add(expressionBlobKey(asset.id, expression.id));
      }
    }
  }
  return keys;
}

export function getActorThumbnailExpressionId(actor: Asset): string {
  ensureActorExpressions(actor);
  return getDefaultExpressionId(actor);
}

type LegacyStoryNode = StoryNode & { actorIds?: string[] };

/** Migrate legacy actorIds to actorConfigs and normalize expression references. */
export function migrateActorSceneReferences(project: Project): void {
  ensureAllActorExpressions(project);

  for (const story of project.stories) {
    for (const node of story.nodes) {
      if (node.type !== "scene" && node.type !== undefined) continue;

      const legacyNode = node as LegacyStoryNode;
      const legacyActorIds = legacyNode.actorIds;
      if (legacyActorIds && legacyActorIds.length > 0) {
        node.actorConfigs = legacyActorIds.map((actorId) => {
          const actor = project.assets.find((asset) => asset.id === actorId && asset.type === "actor");
          return {
            assetId: actorId,
            expressionId: actor ? getDefaultExpressionId(actor) : actorId,
          };
        });
        delete legacyNode.actorIds;
      }

      node.actorConfigs = node.actorConfigs ?? [];

      for (const config of node.actorConfigs) {
        const actor = project.assets.find(
          (asset) => asset.id === config.assetId && asset.type === "actor"
        );
        if (!actor) continue;
        if (!findExpression(actor, config.expressionId)) {
          config.expressionId = getDefaultExpressionId(actor);
        }
      }
    }
  }
}
