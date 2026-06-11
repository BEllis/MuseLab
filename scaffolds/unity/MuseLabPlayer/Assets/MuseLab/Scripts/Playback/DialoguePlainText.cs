using System.Collections.Generic;
using System.Text;

namespace MuseLab.Playback
{
    public static class DialoguePlainText
    {
        public static string FromMarkup(string markup)
        {
            if (string.IsNullOrEmpty(markup)) return "";
            var plain = new StringBuilder();
            var i = 0;
            while (i < markup.Length)
            {
                if (markup[i] == '<')
                {
                    if (i + 4 <= markup.Length && markup.Substring(i, 4).Equals("<br>", System.StringComparison.OrdinalIgnoreCase))
                    {
                        plain.Append('\n');
                        i += 4;
                        continue;
                    }
                    var end = markup.IndexOf('>', i);
                    i = end < 0 ? markup.Length : end + 1;
                    continue;
                }
                if (markup[i] == '&')
                {
                    var decoded = TryDecodeEntity(markup, i, out var len);
                    plain.Append(decoded);
                    i += len;
                    continue;
                }
                plain.Append(markup[i]);
                i++;
            }
            return plain.ToString();
        }

        public static string PrefixForPlainLength(string markup, int targetPlainLength)
        {
            if (targetPlainLength <= 0) return "";
            var plainCount = 0;
            var i = 0;
            var output = new StringBuilder();
            while (i < markup.Length)
            {
                if (markup[i] == '<')
                {
                    var end = markup.IndexOf('>', i);
                    if (end < 0)
                    {
                        output.Append(markup.Substring(i));
                        break;
                    }
                    output.Append(markup, i, end - i + 1);
                    i = end + 1;
                    continue;
                }
                if (markup[i] == '&')
                {
                    var entity = ReadEntity(markup, i, out var len);
                    output.Append(entity);
                    plainCount++;
                    i += len;
                }
                else
                {
                    output.Append(markup[i]);
                    plainCount++;
                    i++;
                }
                if (plainCount >= targetPlainLength) break;
            }
            return output.ToString();
        }

        public static string PrefixForWordCount(string markup, int targetWords)
        {
            if (targetWords <= 0) return "";
            var plain = FromMarkup(markup);
            var boundaries = WordBoundaryPlainLengths(plain);
            if (boundaries.Count == 0) return "";
            var plainLength = boundaries[System.Math.Min(targetWords, boundaries.Count) - 1];
            return PrefixForPlainLength(markup, plainLength);
        }

        public static List<int> WordBoundaryPlainLengths(string plain)
        {
            var boundaries = new List<int>();
            var inWord = false;
            for (var index = 0; index <= plain.Length; index++)
            {
                var ch = index < plain.Length ? plain[index] : '\0';
                var isBoundary = index >= plain.Length || char.IsWhiteSpace(ch);
                if (!inWord && index < plain.Length && !char.IsWhiteSpace(ch))
                    inWord = true;
                if (inWord && isBoundary)
                {
                    boundaries.Add(index);
                    inWord = false;
                }
            }
            return boundaries;
        }

        public static bool HasVisibleText(string markup)
        {
            var plain = FromMarkup(markup);
            return !string.IsNullOrWhiteSpace(plain);
        }

        static string ReadEntity(string markup, int index, out int length)
        {
            var end = markup.IndexOf(';', index);
            if (end < 0)
            {
                length = 1;
                return markup[index].ToString();
            }
            length = end - index + 1;
            return markup.Substring(index, length);
        }

        static char TryDecodeEntity(string markup, int index, out int length)
        {
            var end = markup.IndexOf(';', index);
            if (end < 0)
            {
                length = 1;
                return markup[index];
            }
            var entity = markup.Substring(index, end - index + 1);
            length = entity.Length;
            return entity switch
            {
                "&lt;" => '<',
                "&gt;" => '>',
                "&amp;" => '&',
                "&quot;" => '"',
                "&nbsp;" => ' ',
                "&#160;" => ' ',
                _ => entity[0],
            };
        }
    }
}
