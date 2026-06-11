using System.Text;

namespace MuseLab.Playback
{
    public static class MarkupUtil
    {
        public static string StripTags(string markup)
        {
            if (string.IsNullOrEmpty(markup)) return "";
            var sb = new StringBuilder();
            var i = 0;
            while (i < markup.Length)
            {
                if (markup[i] == '<')
                {
                    var end = markup.IndexOf('>', i);
                    if (end < 0) break;
                    i = end + 1;
                    continue;
                }
                if (markup[i] == '&')
                {
                    if (markup.Substring(i).StartsWith("&amp;")) { sb.Append('&'); i += 5; continue; }
                    if (markup.Substring(i).StartsWith("&lt;")) { sb.Append('<'); i += 4; continue; }
                    if (markup.Substring(i).StartsWith("&gt;")) { sb.Append('>'); i += 4; continue; }
                }
                sb.Append(markup[i]);
                i++;
            }
            return sb.ToString();
        }

        public static string PrefixForPlainLength(string markup, int targetPlainLength)
        {
            if (targetPlainLength <= 0) return "";
            var plainCount = 0;
            var i = 0;
            var output = new StringBuilder();
            while (i < markup.Length && plainCount < targetPlainLength)
            {
                if (markup[i] == '<')
                {
                    var end = markup.IndexOf('>', i);
                    if (end < 0) { output.Append(markup.Substring(i)); break; }
                    output.Append(markup, i, end - i + 1);
                    i = end + 1;
                    continue;
                }
                if (markup[i] == '&')
                {
                    if (markup.Substring(i).StartsWith("&amp;")) { output.Append("&amp;"); plainCount++; i += 5; continue; }
                    if (markup.Substring(i).StartsWith("&lt;")) { output.Append("&lt;"); plainCount++; i += 4; continue; }
                    if (markup.Substring(i).StartsWith("&gt;")) { output.Append("&gt;"); plainCount++; i += 4; continue; }
                }
                output.Append(markup[i]);
                plainCount++;
                i++;
            }
            return output.ToString();
        }

        public static string PrefixForWordCount(string markup, int targetWordCount)
        {
            if (targetWordCount <= 0) return "";
            var plain = StripTags(markup);
            var words = plain.Split((char[])null, System.StringSplitOptions.RemoveEmptyEntries);
            if (targetWordCount >= words.Length) return markup;
            var targetPlainLen = 0;
            var count = 0;
            var i = 0;
            while (i < plain.Length && count < targetWordCount)
            {
                while (i < plain.Length && char.IsWhiteSpace(plain[i])) i++;
                if (i >= plain.Length) break;
                while (i < plain.Length && !char.IsWhiteSpace(plain[i])) { targetPlainLen++; i++; }
                count++;
            }
            return PrefixForPlainLength(markup, targetPlainLen);
        }
    }
}
