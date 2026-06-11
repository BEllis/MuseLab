using System;
using TMPro;

namespace MuseLab.UI.Dialogue
{
    public static class DialogueLayoutEngine
    {
        public const int DefaultContinuationVisualLineInterval = 3;
        public const float DialogueHintReservePx = 22f;

        public static bool ShouldResetDialogueLinePage(string previousMarkup, string nextMarkup)
        {
            if (string.IsNullOrEmpty(nextMarkup)) return true;
            if (string.IsNullOrEmpty(previousMarkup)) return false;
            return nextMarkup.Length < previousMarkup.Length || !nextMarkup.StartsWith(previousMarkup, StringComparison.Ordinal);
        }

        public static float[] MeasureLineBaselines(TMP_Text text)
        {
            if (text == null) return new[] { 0f };
            text.ForceMeshUpdate();
            var info = text.textInfo;
            if (info.lineCount <= 0) return new[] { 0f };
            var offsets = new float[info.lineCount];
            for (var i = 0; i < info.lineCount; i++)
                offsets[i] = info.lineInfo[i].baseline;
            return offsets;
        }

        public static float ContentHeight(float[] lineOffsets, TMP_Text text)
        {
            if (lineOffsets == null || lineOffsets.Length == 0) return 0f;
            text.ForceMeshUpdate();
            var last = lineOffsets.Length - 1;
            var lineHeight = text.fontSize * 1.6f;
            return Math.Max(lineHeight, lineOffsets[last] - lineOffsets[0] + lineHeight);
        }

        public static int CountLinesThatFit(float[] lineOffsets, float contentHeight, int startLine, float viewportHeightPx)
        {
            if (lineOffsets == null || lineOffsets.Length == 0) return 1;
            if (viewportHeightPx <= 0f) return 1;
            var top = lineOffsets[Math.Min(startLine, lineOffsets.Length - 1)];
            var count = 0;
            for (var i = startLine; i < lineOffsets.Length; i++)
            {
                var lineBottom = i + 1 < lineOffsets.Length ? lineOffsets[i + 1] : contentHeight;
                if (count > 0 && lineBottom - top > viewportHeightPx) break;
                count++;
            }
            return Math.Max(1, count);
        }

        public static (int linesOnPage, bool hasMoreToPaginate) GetDialoguePageState(
            float[] lineOffsets,
            float contentHeight,
            int startLineIndex,
            float viewportHeightPx)
        {
            var linesOnPage = CountLinesThatFit(lineOffsets, contentHeight, startLineIndex, viewportHeightPx);
            var nextStart = startLineIndex + linesOnPage;
            var hasMore = nextStart < (lineOffsets?.Length ?? 0);
            return (linesOnPage, hasMore);
        }

        public static int ClampDialogueStartLine(float[] lineOffsets, int startLineIndex)
        {
            if (lineOffsets == null || lineOffsets.Length == 0) return 0;
            return Math.Min(startLineIndex, Math.Max(0, lineOffsets.Length - 1));
        }

        public static int GetLastPageStartLine(float[] lineOffsets, float contentHeight, float viewportHeightPx, int startLineIndex = 0)
        {
            var pageStart = ClampDialogueStartLine(lineOffsets, startLineIndex);
            while (true)
            {
                var (linesOnPage, _) = GetDialoguePageState(lineOffsets, contentHeight, pageStart, viewportHeightPx);
                var nextStart = pageStart + linesOnPage;
                if (lineOffsets == null || nextStart >= lineOffsets.Length) return pageStart;
                pageStart = nextStart;
            }
        }

        public static float DialogueContentHeightPx(float viewportClientHeight, float hintReservePx)
        {
            return Math.Max(0f, viewportClientHeight - 4f - hintReservePx);
        }

        public static string AppendInlineDialogueMoreHint(string markup)
        {
            if (string.IsNullOrWhiteSpace(markup)) return markup;
            const string hint = " <color=#64748b>...</color>";
            var trimmed = markup.TrimEnd();
            if (trimmed.EndsWith("</b>", StringComparison.OrdinalIgnoreCase)
                || trimmed.EndsWith("</i>", StringComparison.OrdinalIgnoreCase)
                || trimmed.EndsWith("</color>", StringComparison.OrdinalIgnoreCase)
                || trimmed.EndsWith("</size>", StringComparison.OrdinalIgnoreCase)
                || trimmed.EndsWith("</font>", StringComparison.OrdinalIgnoreCase))
                return trimmed + hint;
            return trimmed + hint;
        }
    }
}
