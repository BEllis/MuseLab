using System.Text.RegularExpressions;

namespace MuseLab.Playback
{
    public static class SpeakerTemplateRenderer
    {
        static readonly Regex TokenRegex = new(@"\{\{\s*([^}]+)\s*\}\}", RegexOptions.Compiled);

        public static string Render(string template)
        {
            if (string.IsNullOrEmpty(template)) return "";
            return TokenRegex.Replace(template, match =>
            {
                var key = match.Groups[1].Value.Trim();
                return key switch
                {
                    "name" => "",
                    _ => match.Value,
                };
            });
        }
    }
}
