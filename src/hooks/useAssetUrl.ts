import { useState, useEffect } from "react";
import type { Project } from "@/core/model/types";
import { getAssetUrlSync, getAssetUrlAsync } from "@/core/assets/resolver";

export function useAssetUrl(project: Project, assetId: string | null): string {
  const [url, setUrl] = useState(() =>
    assetId ? getAssetUrlSync(project, assetId) : ""
  );

  useEffect(() => {
    if (!assetId) {
      setUrl("");
      return;
    }
    const sync = getAssetUrlSync(project, assetId);
    if (sync) {
      setUrl(sync);
      return;
    }
    getAssetUrlAsync(project, assetId).then(setUrl);
  }, [project, assetId]);

  return url;
}
