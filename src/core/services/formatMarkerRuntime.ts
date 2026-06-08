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
  | "shakePhraseText";

export type FormatMarker = {
  kind: FormatMarkerKind;
  colorHex?: string;
  text?: string;
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
  };
}
