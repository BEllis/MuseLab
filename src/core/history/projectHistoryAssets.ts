import type { Project } from "../model/types";
import { collectExpressionBlobKeys } from "../assets/actorExpressions";

export function collectAssetIdsFromProject(project: Project): Set<string> {
  const ids = new Set(project.assets.map((asset) => asset.id));
  for (const key of collectExpressionBlobKeys(project)) {
    ids.add(key);
  }
  return ids;
}
