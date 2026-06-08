import { useState, useEffect } from "react";
import type { Project } from "@/core/model/types";
import { getActorExpressionUrlSync, getActorExpressionUrlAsync } from "@/core/assets/resolver";

export function useActorExpressionUrl(
  project: Project,
  actorId: string | null,
  expressionId: string | null
): string {
  const [url, setUrl] = useState(() =>
    actorId && expressionId ? getActorExpressionUrlSync(project, actorId, expressionId) : ""
  );

  useEffect(() => {
    if (!actorId || !expressionId) {
      setUrl("");
      return;
    }
    const sync = getActorExpressionUrlSync(project, actorId, expressionId);
    if (sync) {
      setUrl(sync);
      return;
    }
    getActorExpressionUrlAsync(project, actorId, expressionId).then(setUrl);
  }, [project, actorId, expressionId]);

  return url;
}
