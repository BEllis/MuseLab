namespace MuseLab.Bridge
{
    public class UnityMuseLabFormat : IMuseLabFormat
    {
        public override string BoldStart() => FormatMarkerCodec.Encode(FormatMarkerKind.BoldStart);
        public override string BoldEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.BoldEnd);
        public override string ItalicStart() => FormatMarkerCodec.Encode(FormatMarkerKind.ItalicStart);
        public override string ItalicEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.ItalicEnd);

        public override string ColorStart(string colorHex) =>
            FormatMarkerCodec.Encode(FormatMarkerKind.ColorStart, new FormatMarkerData { color = colorHex });

        public override string ColorEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.ColorEnd);
        public override string ShakeCharsStart() => FormatMarkerCodec.Encode(FormatMarkerKind.ShakeCharsStart);
        public override string ShakeCharsEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.ShakeCharsEnd);
        public override string ShakePhraseStart() => FormatMarkerCodec.Encode(FormatMarkerKind.ShakePhraseStart);
        public override string ShakePhraseEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.ShakePhraseEnd);

        public override string ShakeCharsText(string text) =>
            FormatMarkerCodec.Encode(FormatMarkerKind.ShakeCharsText, new FormatMarkerData { text = text });

        public override string ShakePhraseText(string text) =>
            FormatMarkerCodec.Encode(FormatMarkerKind.ShakePhraseText, new FormatMarkerData { text = text });

        public override string FontStyleBegin(string fontAssetId, int fontSizePx, int fontWeight) =>
            FormatMarkerCodec.Encode(FormatMarkerKind.FontStyleBegin, new FormatMarkerData
            {
                id = fontAssetId,
                fontSizePx = fontSizePx,
                fontWeight = fontWeight,
            });

        public override string FontStyleByPathBegin(string groupPath, string assetName, int fontSizePx, int fontWeight) =>
            FormatMarkerCodec.Encode(FormatMarkerKind.FontStyleByPathBegin, new FormatMarkerData
            {
                groupPath = groupPath,
                assetName = assetName,
                fontSizePx = fontSizePx,
                fontWeight = fontWeight,
            });

        public override string FontStyleEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.FontStyleEnd);

        public override string FontSizeBegin(int fontSizePx) =>
            FormatMarkerCodec.Encode(FormatMarkerKind.FontSizeBegin, new FormatMarkerData { fontSizePx = fontSizePx });

        public override string FontSizeEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.FontSizeEnd);

        public override string FontWeightBegin(int fontWeight) =>
            FormatMarkerCodec.Encode(FormatMarkerKind.FontWeightBegin, new FormatMarkerData { fontWeight = fontWeight });

        public override string FontWeightEnd() => FormatMarkerCodec.Encode(FormatMarkerKind.FontWeightEnd);
    }
}
