import { expressionBlobKey } from "@/core/assets/actorExpressions";
import type { Project } from "@/core/model/types";
import type { AppEvent } from "./types";
import type { EventLogState } from "./eventLog";
import { collectEventsFromLog } from "./eventLog";

export function collectAssetIdsFromProject(project: Project): Set<string> {
  const ids = new Set(project.assets.map((asset) => asset.id));
  for (const asset of project.assets) {
    for (const expression of asset.expressions ?? []) {
      ids.add(expressionBlobKey(asset.id, expression.id));
    }
  }
  return ids;
}

function collectAssetIdsFromEvent(event: AppEvent, ids: Set<string>): void {
  switch (event.type) {
    case "addAsset":
    case "addBlankActor":
    case "addActorFromImage":
      ids.add(event.after.id);
      for (const expression of event.after.expressions ?? []) {
        ids.add(expressionBlobKey(event.after.id, expression.id));
      }
      break;
    case "removeAsset":
      ids.add(event.before.asset.id);
      for (const expression of event.before.asset.expressions ?? []) {
        ids.add(expressionBlobKey(event.before.asset.id, expression.id));
      }
      break;
    case "addActorExpression":
      ids.add(expressionBlobKey(event.actorId, event.after.id));
      break;
    case "removeActorExpression":
      ids.add(expressionBlobKey(event.actorId, event.before.id));
      break;
    case "replaceAssetMedia":
    case "updateAsset":
      ids.add(event.assetId);
      break;
    case "replaceActorExpressionMedia":
      ids.add(expressionBlobKey(event.actorId, event.expressionId));
      break;
    case "batch":
      for (const child of event.events) {
        collectAssetIdsFromEvent(child, ids);
      }
      break;
    default:
      break;
  }
}

export function collectAssetIdsFromEventLog(log: EventLogState): Set<string> {
  const ids = new Set<string>();
  for (const event of collectEventsFromLog(log)) {
    collectAssetIdsFromEvent(event, ids);
  }
  return ids;
}
