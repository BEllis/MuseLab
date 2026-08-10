import type { ActorExpression, Asset, Project } from "../model/types";
import type { PromptsByLocale } from "../locale/prompts";
import { generateId } from "../model/id";
import { collectActionAssetRefs } from "../scene/actionAssets";
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

/** Scenes whose scripted actions render a specific actor expression. */
export function getExpressionUsage(
  promptsByLocale: PromptsByLocale,
  actorId: string,
  expressionId: string
): number {
  const seenScenes = new Set<string>();
  for (const prompts of Object.values(promptsByLocale)) {
    for (const [storyId, storyPrompts] of Object.entries(prompts.stories)) {
      for (const [nodeId, entry] of Object.entries(storyPrompts.nodes)) {
        const sceneKey = `${storyId}:${nodeId}`;
        if (seenScenes.has(sceneKey)) continue;
        const used = collectActionAssetRefs(entry.actions ?? []).some(
          (ref) =>
            ref.role === "prop" && ref.assetId === actorId && ref.variationId === expressionId
        );
        if (used) seenScenes.add(sceneKey);
      }
    }
  }
  return seenScenes.size;
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

/**
 * Repoint prop actions at a valid expression when the referenced one is gone.
 * Actions are the only place expressions are selected, so this runs over prompts.
 */
export function normalizeActorExpressionReferences(
  project: Project,
  promptsByLocale: PromptsByLocale
): void {
  ensureAllActorExpressions(project);

  const resolveVariation = (assetId: string, variationId: string | undefined): string | undefined => {
    const actor = project.assets.find(
      (asset) => asset.id === assetId && asset.type === "actor"
    );
    if (!actor) return variationId;
    if (variationId && findExpression(actor, variationId)) return variationId;
    return getDefaultExpressionId(actor);
  };

  for (const prompts of Object.values(promptsByLocale)) {
    for (const storyPrompts of Object.values(prompts.stories)) {
      for (const entry of Object.values(storyPrompts.nodes)) {
        if (!entry.actions) continue;
        const propAssets = new Map<string, string>();
        entry.actions = entry.actions.map((action) => {
          if (action.kind === "prop.add") {
            propAssets.set(action.id, action.assetId);
            const variationId = resolveVariation(action.assetId, action.variationId);
            return variationId ? { ...action, variationId } : action;
          }
          if (action.kind === "prop.setVariation") {
            const assetId = propAssets.get(action.id);
            if (!assetId) return action;
            const variationId = resolveVariation(assetId, action.variationId);
            return variationId ? { ...action, variationId } : action;
          }
          return action;
        });
      }
    }
  }
}
