import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/core/model/types";
import { getDefaultFontId } from "@/core/assets/defaultFont";
import {
  fontFamilyForAsset,
  loadFontsForProject,
  parseFontIdsFromHtml,
} from "@/core/assets/fontFaces";

export function useLoadedFonts(project: Project, html: string): {
  ready: boolean;
  defaultFontFamily: string;
} {
  const defaultFontId = getDefaultFontId(project);
  const fontIds = useMemo(() => {
    const ids = new Set(parseFontIdsFromHtml(html));
    ids.add(defaultFontId);
    return [...ids];
  }, [html, defaultFontId]);

  const fontIdsKey = fontIds.join("\0");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void loadFontsForProject(project, fontIds).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [project, fontIdsKey, fontIds]);

  return {
    ready,
    defaultFontFamily: fontFamilyForAsset(defaultFontId),
  };
}
