using System;
using UnityEngine;

namespace MuseLab.Bridge
{
    public enum FormatMarkerKind
    {
        BoldStart,
        BoldEnd,
        ItalicStart,
        ItalicEnd,
        ColorStart,
        ColorEnd,
        ShakeCharsStart,
        ShakeCharsEnd,
        ShakePhraseStart,
        ShakePhraseEnd,
        ShakeCharsText,
        ShakePhraseText,
        FontStyleBegin,
        FontStyleByPathBegin,
        FontStyleEnd,
        FontSizeBegin,
        FontSizeEnd,
        FontWeightBegin,
        FontWeightEnd,
    }

    [Serializable]
    public class FormatMarkerData
    {
        public string k;
        public string color;
        public string text;
        public string id;
        public string groupPath;
        public string assetName;
        public int fontSizePx = -1;
        public int fontWeight = -1;
    }

    public static class FormatMarkerCodec
    {
        public static string Encode(FormatMarkerKind kind, FormatMarkerData extra = null)
        {
            var data = extra ?? new FormatMarkerData();
            data.k = KindToKey(kind);
            return JsonUtility.ToJson(data);
        }

        public static bool TryDecode(string marker, out FormatMarkerKind kind, out FormatMarkerData data)
        {
            kind = default;
            data = null;
            if (string.IsNullOrEmpty(marker)) return false;
            try
            {
                data = JsonUtility.FromJson<FormatMarkerData>(marker);
                if (data == null || string.IsNullOrEmpty(data.k)) return false;
                kind = KeyToKind(data.k);
                return true;
            }
            catch
            {
                return false;
            }
        }

        static string KindToKey(FormatMarkerKind kind) => kind switch
        {
            FormatMarkerKind.BoldStart => "boldStart",
            FormatMarkerKind.BoldEnd => "boldEnd",
            FormatMarkerKind.ItalicStart => "italicStart",
            FormatMarkerKind.ItalicEnd => "italicEnd",
            FormatMarkerKind.ColorStart => "colorStart",
            FormatMarkerKind.ColorEnd => "colorEnd",
            FormatMarkerKind.ShakeCharsStart => "shakeCharsStart",
            FormatMarkerKind.ShakeCharsEnd => "shakeCharsEnd",
            FormatMarkerKind.ShakePhraseStart => "shakePhraseStart",
            FormatMarkerKind.ShakePhraseEnd => "shakePhraseEnd",
            FormatMarkerKind.ShakeCharsText => "shakeCharsText",
            FormatMarkerKind.ShakePhraseText => "shakePhraseText",
            FormatMarkerKind.FontStyleBegin => "fontStyleBegin",
            FormatMarkerKind.FontStyleByPathBegin => "fontStyleByPathBegin",
            FormatMarkerKind.FontStyleEnd => "fontStyleEnd",
            FormatMarkerKind.FontSizeBegin => "fontSizeBegin",
            FormatMarkerKind.FontSizeEnd => "fontSizeEnd",
            FormatMarkerKind.FontWeightBegin => "fontWeightBegin",
            FormatMarkerKind.FontWeightEnd => "fontWeightEnd",
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };

        static FormatMarkerKind KeyToKind(string key) => key switch
        {
            "boldStart" => FormatMarkerKind.BoldStart,
            "boldEnd" => FormatMarkerKind.BoldEnd,
            "italicStart" => FormatMarkerKind.ItalicStart,
            "italicEnd" => FormatMarkerKind.ItalicEnd,
            "colorStart" => FormatMarkerKind.ColorStart,
            "colorEnd" => FormatMarkerKind.ColorEnd,
            "shakeCharsStart" => FormatMarkerKind.ShakeCharsStart,
            "shakeCharsEnd" => FormatMarkerKind.ShakeCharsEnd,
            "shakePhraseStart" => FormatMarkerKind.ShakePhraseStart,
            "shakePhraseEnd" => FormatMarkerKind.ShakePhraseEnd,
            "shakeCharsText" => FormatMarkerKind.ShakeCharsText,
            "shakePhraseText" => FormatMarkerKind.ShakePhraseText,
            "fontStyleBegin" => FormatMarkerKind.FontStyleBegin,
            "fontStyleByPathBegin" => FormatMarkerKind.FontStyleByPathBegin,
            "fontStyleEnd" => FormatMarkerKind.FontStyleEnd,
            "fontSizeBegin" => FormatMarkerKind.FontSizeBegin,
            "fontSizeEnd" => FormatMarkerKind.FontSizeEnd,
            "fontWeightBegin" => FormatMarkerKind.FontWeightBegin,
            "fontWeightEnd" => FormatMarkerKind.FontWeightEnd,
            _ => throw new InvalidOperationException($"Unknown format marker kind: {key}"),
        };
    }
}
