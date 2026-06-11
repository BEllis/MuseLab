using System.Collections.Generic;
using System.Text;

namespace MuseLab.Bridge
{
    enum ShakeMode
    {
        None,
        Chars,
        Phrase,
    }

    public class RichTextBuilder
    {
        const int ShakeCharVariantCount = 8;

        readonly StringBuilder output = new();
        readonly List<int> fontBlockNestedSpans = new();
        ShakeMode shakeMode = ShakeMode.None;
        bool disableShake;

        public RichTextBuilder(bool disableShake = false)
        {
            this.disableShake = disableShake;
        }

        public void AddLiteral(string text)
        {
            PushMarkup(LiteralToMarkup(text, shakeMode), text);
        }

        public void AppendResult(string value)
        {
            if (string.IsNullOrEmpty(value)) return;
            PushMarkup(Escape(value), value);
        }

        public void ApplyFormat(string marker)
        {
            if (!FormatMarkerCodec.TryDecode(marker, out var kind, out var data)) return;
            var markup = MarkerToMarkup(kind, data);
            var plain = MarkerPlainText(kind, data);
            if (!string.IsNullOrEmpty(markup))
                PushMarkup(markup, plain);
            shakeMode = UpdateShakeMode(kind, shakeMode);
        }

        public string Render() => output.ToString();

        public void Clear()
        {
            output.Clear();
            fontBlockNestedSpans.Clear();
            shakeMode = ShakeMode.None;
        }

        void PushMarkup(string markup, string plainText)
        {
            if (string.IsNullOrEmpty(markup)) return;
            output.Append(markup);
        }

        string LiteralToMarkup(string text, ShakeMode mode)
        {
            if (string.IsNullOrEmpty(text)) return "";
            if (disableShake || mode == ShakeMode.None)
                return EscapeWithNewlines(text);
            if (mode == ShakeMode.Chars)
                return ShakeCharsMarkup(text);
            return $"<shake phrase=\"1\">{EscapeWithNewlines(text)}</shake>";
        }

        string ShakeCharsMarkup(string text)
        {
            var sb = new StringBuilder();
            foreach (var ch in text)
            {
                if (ch == '\n') { sb.Append('\n'); continue; }
                if (ch == ' ') { sb.Append(' '); continue; }
                var variant = UnityEngine.Random.Range(0, ShakeCharVariantCount);
                sb.Append($"<shake char=\"{variant}\">{Escape(ch.ToString())}</shake>");
            }
            return sb.ToString();
        }

        string MarkerToMarkup(FormatMarkerKind kind, FormatMarkerData data)
        {
            switch (kind)
            {
                case FormatMarkerKind.BoldStart: return "<b>";
                case FormatMarkerKind.BoldEnd: return "</b>";
                case FormatMarkerKind.ItalicStart: return "<i>";
                case FormatMarkerKind.ItalicEnd: return "</i>";
                case FormatMarkerKind.ColorStart:
                    if (string.IsNullOrEmpty(data.color) || data.color.Length < 4) return "";
                    return $"<color={data.color}>";
                case FormatMarkerKind.ColorEnd: return "</color>";
                case FormatMarkerKind.ShakeCharsStart:
                    return disableShake ? "" : "<shake chars=\"1\">";
                case FormatMarkerKind.ShakeCharsEnd:
                    return disableShake ? "" : "</shake>";
                case FormatMarkerKind.ShakePhraseStart:
                    return disableShake ? "" : "<shake phrase=\"1\">";
                case FormatMarkerKind.ShakePhraseEnd:
                    return disableShake ? "" : "</shake>";
                case FormatMarkerKind.ShakeCharsText:
                    return disableShake ? EscapeWithNewlines(data.text) : ShakeCharsMarkup(data.text ?? "");
                case FormatMarkerKind.ShakePhraseText:
                    return disableShake ? EscapeWithNewlines(data.text) : $"<shake phrase=\"1\">{EscapeWithNewlines(data.text)}</shake>";
                case FormatMarkerKind.FontStyleBegin:
                    if (string.IsNullOrEmpty(data.id)) return "";
                    fontBlockNestedSpans.Add(0);
                    return BuildFontOpen(data);
                case FormatMarkerKind.FontStyleByPathBegin:
                    if (string.IsNullOrEmpty(data.assetName)) return "";
                    fontBlockNestedSpans.Add(0);
                    return BuildFontOpen(new FormatMarkerData { id = data.assetName, fontSizePx = data.fontSizePx, fontWeight = data.fontWeight });
                case FormatMarkerKind.FontStyleEnd:
                    return CloseFontBlock();
                case FormatMarkerKind.FontSizeBegin:
                    if (!IsValidFontSize(data.fontSizePx) || fontBlockNestedSpans.Count == 0) return "";
                    fontBlockNestedSpans[fontBlockNestedSpans.Count - 1]++;
                    return $"<size={data.fontSizePx}>";
                case FormatMarkerKind.FontSizeEnd:
                    return CloseNestedSpan();
                case FormatMarkerKind.FontWeightBegin:
                    if (!IsValidFontWeight(data.fontWeight) || fontBlockNestedSpans.Count == 0) return "";
                    fontBlockNestedSpans[fontBlockNestedSpans.Count - 1]++;
                    return $"<style=\"F{data.fontWeight}\">";
                case FormatMarkerKind.FontWeightEnd:
                    return CloseNestedSpan();
                default:
                    return "";
            }
        }

        static string BuildFontOpen(FormatMarkerData data)
        {
            var styles = new List<string>();
            if (IsValidFontSize(data.fontSizePx)) styles.Add($"size={data.fontSizePx}");
            if (IsValidFontWeight(data.fontWeight)) styles.Add($"style=F{data.fontWeight}");
            return styles.Count > 0 ? $"<font=\"{Escape(data.id)}\"><{string.Join("><", styles)}>" : $"<font=\"{Escape(data.id)}\">";
        }

        string CloseFontBlock()
        {
            if (fontBlockNestedSpans.Count == 0) return "";
            var nested = fontBlockNestedSpans[fontBlockNestedSpans.Count - 1];
            fontBlockNestedSpans.RemoveAt(fontBlockNestedSpans.Count - 1);
            var sb = new StringBuilder();
            for (var i = 0; i < nested; i++) sb.Append("</style></size>");
            sb.Append("</font>");
            return sb.ToString();
        }

        string CloseNestedSpan()
        {
            if (fontBlockNestedSpans.Count == 0) return "";
            var nested = fontBlockNestedSpans[fontBlockNestedSpans.Count - 1];
            if (nested <= 0) return "";
            fontBlockNestedSpans[fontBlockNestedSpans.Count - 1] = nested - 1;
            return "</size>";
        }

        static string MarkerPlainText(FormatMarkerKind kind, FormatMarkerData data) =>
            kind is FormatMarkerKind.ShakeCharsText or FormatMarkerKind.ShakePhraseText ? data.text ?? "" : "";

        static ShakeMode UpdateShakeMode(FormatMarkerKind kind, ShakeMode mode) => kind switch
        {
            FormatMarkerKind.ShakeCharsStart => ShakeMode.Chars,
            FormatMarkerKind.ShakeCharsEnd => ShakeMode.None,
            FormatMarkerKind.ShakePhraseStart => ShakeMode.Phrase,
            FormatMarkerKind.ShakePhraseEnd => ShakeMode.None,
            _ => mode,
        };

        static bool IsValidFontSize(int px) => px >= 1 && px <= 200;
        static bool IsValidFontWeight(int weight) => weight >= 100 && weight <= 900 && weight % 100 == 0;

        static string EscapeWithNewlines(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            return Escape(text).Replace("\n", "\n");
        }

        static string Escape(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            return text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
        }
    }
}
