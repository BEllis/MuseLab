using System.Collections.Generic;
using System.Text;
using MuseLab.Export;
using UnityEngine;

namespace MuseLab.UI.Dialogue
{
    public class DialogueTmpRenderer
    {
        readonly DialogueFontRegistry fontRegistry;

        public DialogueTmpRenderer(DialogueFontRegistry registry = null)
        {
            fontRegistry = registry;
        }

        public string BuildTmpString(IReadOnlyList<DialogueGlyph> glyphs)
        {
            if (glyphs == null || glyphs.Count == 0) return "";

            var sb = new StringBuilder();
            var runStart = 0;
            while (runStart < glyphs.Count)
            {
                var runEnd = runStart + 1;
                while (runEnd < glyphs.Count && SameRunStyle(glyphs[runStart], glyphs[runEnd]))
                    runEnd++;
                AppendRun(sb, glyphs, runStart, runEnd);
                runStart = runEnd;
            }
            return sb.ToString();
        }

        static bool SameRunStyle(DialogueGlyph a, DialogueGlyph b)
        {
            return a.Character != '\n' && b.Character != '\n'
                && a.Bold == b.Bold
                && a.Italic == b.Italic
                && a.Color == b.Color
                && a.SizePx == b.SizePx
                && a.FontWeight == b.FontWeight
                && a.FontId == b.FontId
                && a.ShakeMode == b.ShakeMode
                && a.ShakeVariant == b.ShakeVariant
                && a.PhraseGroupId == b.PhraseGroupId;
        }

        void AppendRun(StringBuilder sb, IReadOnlyList<DialogueGlyph> glyphs, int start, int end)
        {
            var g0 = glyphs[start];
            if (g0.Bold) sb.Append("<b>");
            if (g0.Italic) sb.Append("<i>");
            if (g0.Color != MuseLabUiStyles.TextDark)
                sb.Append($"<color=#{ColorUtility.ToHtmlStringRGBA(g0.Color)}>");
            if (g0.SizePx > 0 && g0.SizePx != (int)MuseLabUiStyles.DialogueFontSize)
                sb.Append($"<size={g0.SizePx}>");
            if (g0.FontWeight > 0)
                sb.Append($"<style=\"F{g0.FontWeight}\">");
            if (!string.IsNullOrEmpty(g0.FontId))
            {
                var family = fontRegistry != null
                    ? fontRegistry.GetTmpFontFamily(g0.FontId)
                    : g0.FontId;
                if (!string.IsNullOrEmpty(family))
                    sb.Append($"<font=\"{family}\">");
            }

            for (var i = start; i < end; i++)
            {
                var ch = glyphs[i].Character;
                if (ch == '\n') sb.Append('\n');
                else if (ch == '\u00a0') sb.Append('\u00a0');
                else sb.Append(ch);
            }

            if (!string.IsNullOrEmpty(g0.FontId) && (fontRegistry == null || fontRegistry.HasFont(g0.FontId)))
                sb.Append("</font>");
            if (g0.FontWeight > 0) sb.Append("</style>");
            if (g0.SizePx > 0 && g0.SizePx != (int)MuseLabUiStyles.DialogueFontSize) sb.Append("</size>");
            if (g0.Color != MuseLabUiStyles.TextDark) sb.Append("</color>");
            if (g0.Italic) sb.Append("</i>");
            if (g0.Bold) sb.Append("</b>");
        }
    }
}
