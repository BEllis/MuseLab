using System.Collections.Generic;
using System.Text.RegularExpressions;
using TMPro;
using UnityEngine;

namespace MuseLab.Export
{
    public class DialogueFontRegistry
    {
        static readonly Regex FontTagRegex = new("<font=\"([^\"]+)\"", RegexOptions.Compiled);

        readonly Dictionary<string, TMP_FontAsset> fonts = new();
        readonly string exportRoot;
        TMP_FontAsset fallback;

        public DialogueFontRegistry(string exportRootPath)
        {
            exportRoot = exportRootPath;
            fallback = Resources.Load<TMP_FontAsset>("Fonts & Materials/LiberationSans SDF");
        }

        public void PreloadFromMarkup(string markup)
        {
            if (string.IsNullOrEmpty(markup)) return;
            foreach (Match match in FontTagRegex.Matches(markup))
            {
                var id = match.Groups[1].Value;
                EnsureFont(id);
            }
        }

        public bool HasFont(string fontId) => !string.IsNullOrEmpty(fontId) && fonts.ContainsKey(fontId);

        public string GetTmpFontFamily(string fontId)
        {
            if (string.IsNullOrEmpty(fontId)) return null;
            var asset = EnsureFont(fontId);
            return asset != null ? asset.name : fontId;
        }

        TMP_FontAsset EnsureFont(string fontId)
        {
            if (string.IsNullOrEmpty(fontId)) return fallback;
            if (fonts.TryGetValue(fontId, out var cached)) return cached;

            var loaded = AssetLoader.LoadFont(exportRoot, fontId);
            if (loaded == null)
            {
                fonts[fontId] = fallback;
                return fallback;
            }
            fonts[fontId] = loaded;
            return loaded;
        }

        public string ResolveFontIdByPath(string assetPath)
        {
            if (string.IsNullOrEmpty(assetPath)) return null;
            var fileName = System.IO.Path.GetFileNameWithoutExtension(assetPath);
            return string.IsNullOrEmpty(fileName) ? assetPath : fileName;
        }
    }
}
