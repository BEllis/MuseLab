export type FormatMarkerKind =
  | "boldStart"
  | "boldEnd"
  | "italicStart"
  | "italicEnd"
  | "colorStart"
  | "colorEnd"
  | "shakeCharsStart"
  | "shakeCharsEnd"
  | "shakePhraseStart"
  | "shakePhraseEnd"
  | "shakeCharsText"
  | "shakePhraseText"
  | "fontStyleBegin"
  | "fontStyleByPathBegin"
  | "fontStyleEnd"
  | "fontSizeBegin"
  | "fontSizeEnd"
  | "fontWeightBegin"
  | "fontWeightEnd";

export type FormatMarker = {
  kind: FormatMarkerKind;
  colorHex?: string;
  text?: string;
  fontAssetId?: string;
  fontGroupPath?: string;
  fontAssetName?: string;
  fontSizePx?: number;
  fontWeight?: number;
};

export type FormatMarkerRuntime = {
  boldStart(): FormatMarker;
  boldEnd(): FormatMarker;
  italicStart(): FormatMarker;
  italicEnd(): FormatMarker;
  colorStart(colorHex: string): FormatMarker;
  colorEnd(): FormatMarker;
  shakeCharsStart(): FormatMarker;
  shakeCharsEnd(): FormatMarker;
  shakePhraseStart(): FormatMarker;
  shakePhraseEnd(): FormatMarker;
  shakeCharsText(text: string): FormatMarker;
  shakePhraseText(text: string): FormatMarker;
  fontStyleBegin(fontAssetId: string, fontSizePx?: number, fontWeight?: number): FormatMarker;
  fontStyleByPathBegin(
    groupPath: string,
    assetName: string,
    fontSizePx?: number,
    fontWeight?: number
  ): FormatMarker;
  fontStyleEnd(): FormatMarker;
  fontSizeBegin(fontSizePx: number): FormatMarker;
  fontSizeEnd(): FormatMarker;
  fontWeightBegin(fontWeight: number): FormatMarker;
  fontWeightEnd(): FormatMarker;
};

function marker(kind: FormatMarkerKind, extra?: Partial<FormatMarker>): FormatMarker {
  return { kind, ...extra };
}

export function createFormatMarkerRuntime(): FormatMarkerRuntime {
  return {
    boldStart: () => marker("boldStart"),
    boldEnd: () => marker("boldEnd"),
    italicStart: () => marker("italicStart"),
    italicEnd: () => marker("italicEnd"),
    colorStart: (colorHex) => marker("colorStart", { colorHex }),
    colorEnd: () => marker("colorEnd"),
    shakeCharsStart: () => marker("shakeCharsStart"),
    shakeCharsEnd: () => marker("shakeCharsEnd"),
    shakePhraseStart: () => marker("shakePhraseStart"),
    shakePhraseEnd: () => marker("shakePhraseEnd"),
    shakeCharsText: (text) => marker("shakeCharsText", { text }),
    shakePhraseText: (text) => marker("shakePhraseText", { text }),
    fontStyleBegin: (fontAssetId, fontSizePx = -1, fontWeight = -1) =>
      marker("fontStyleBegin", {
        fontAssetId,
        fontSizePx: fontSizePx >= 1 ? fontSizePx : undefined,
        fontWeight: fontWeight >= 100 ? fontWeight : undefined,
      }),
    fontStyleByPathBegin: (groupPath, assetName, fontSizePx = -1, fontWeight = -1) =>
      marker("fontStyleByPathBegin", {
        fontGroupPath: groupPath,
        fontAssetName: assetName,
        fontSizePx: fontSizePx >= 1 ? fontSizePx : undefined,
        fontWeight: fontWeight >= 100 ? fontWeight : undefined,
      }),
    fontStyleEnd: () => marker("fontStyleEnd"),
    fontSizeBegin: (fontSizePx) => marker("fontSizeBegin", { fontSizePx }),
    fontSizeEnd: () => marker("fontSizeEnd"),
    fontWeightBegin: (fontWeight) => marker("fontWeightBegin", { fontWeight }),
    fontWeightEnd: () => marker("fontWeightEnd"),
  };
}

/** Bridge with PascalCase aliases for transpiled Cito method names. */
export function createFormatMarkerBridge(runtime: FormatMarkerRuntime = createFormatMarkerRuntime()) {
  return {
    ...runtime,
    BoldStart: runtime.boldStart,
    BoldEnd: runtime.boldEnd,
    ItalicStart: runtime.italicStart,
    ItalicEnd: runtime.italicEnd,
    ColorStart: runtime.colorStart,
    ColorEnd: runtime.colorEnd,
    ShakeCharsStart: runtime.shakeCharsStart,
    ShakeCharsEnd: runtime.shakeCharsEnd,
    ShakePhraseStart: runtime.shakePhraseStart,
    ShakePhraseEnd: runtime.shakePhraseEnd,
    ShakeCharsText: runtime.shakeCharsText,
    ShakePhraseText: runtime.shakePhraseText,
    FontStyleBegin: runtime.fontStyleBegin,
    FontStyleByPathBegin: runtime.fontStyleByPathBegin,
    FontStyleEnd: runtime.fontStyleEnd,
    FontSizeBegin: runtime.fontSizeBegin,
    FontSizeEnd: runtime.fontSizeEnd,
    FontWeightBegin: runtime.fontWeightBegin,
    FontWeightEnd: runtime.fontWeightEnd,
  };
}
