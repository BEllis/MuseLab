using System;
using System.Collections.Generic;
using System.IO;
using TMPro;
using UnityEngine;

namespace MuseLab.Export
{
    public static class AssetLoader
    {
        static readonly Dictionary<string, Texture2D> TextureCache = new();
        static readonly Dictionary<string, TMP_FontAsset> FontCache = new();

        public static Texture2D LoadTexture(string exportRoot, string assetId)
        {
            if (string.IsNullOrEmpty(assetId)) return null;
            if (TextureCache.TryGetValue(assetId, out var cached)) return cached;

            var archivePath = MuseLabProjectData.GetAssetArchivePath(assetId);
            var diskPath = ExportLoader.ResolveArchivePath(exportRoot, archivePath);
            if (!File.Exists(diskPath))
            {
                Debug.LogWarning($"Texture asset not found: {diskPath}");
                return null;
            }

            var bytes = File.ReadAllBytes(diskPath);
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            if (!texture.LoadImage(bytes))
            {
                Debug.LogWarning($"Failed to decode texture: {diskPath}");
                UnityEngine.Object.Destroy(texture);
                return null;
            }
            texture.name = assetId;
            TextureCache[assetId] = texture;
            return texture;
        }

        public static Sprite LoadSprite(string exportRoot, string assetId)
        {
            var texture = LoadTexture(exportRoot, assetId);
            if (texture == null) return null;
            return Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f), 100f);
        }

        public static TMP_FontAsset LoadFont(string exportRoot, string fontId)
        {
            if (string.IsNullOrEmpty(fontId)) return null;
            if (FontCache.TryGetValue(fontId, out var cached)) return cached;

            var archivePath = MuseLabProjectData.GetAssetArchivePath(fontId);
            var diskPath = ExportLoader.ResolveArchivePath(exportRoot, archivePath);
            if (!File.Exists(diskPath))
            {
                var ttfPath = Path.Combine(exportRoot, "assets", fontId + ".ttf");
                if (!File.Exists(ttfPath))
                {
                    Debug.LogWarning($"Font asset not found: {fontId}");
                    return null;
                }
                diskPath = ttfPath;
            }

            var font = TryLoadTmpFont(diskPath, fontId);
            if (font != null) FontCache[fontId] = font;
            return font;
        }

        static TMP_FontAsset TryLoadTmpFont(string diskPath, string fontId)
        {
            if (!diskPath.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase)
                && !diskPath.EndsWith(".otf", StringComparison.OrdinalIgnoreCase))
                return null;

            try
            {
                var font = new Font(diskPath);
                if (font == null) return null;
                var tmpAsset = TMP_FontAsset.CreateFontAsset(font);
                if (tmpAsset != null) tmpAsset.name = fontId;
                return tmpAsset;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to load font {fontId}: {ex.Message}");
                return null;
            }
        }

        public static void ClearCache()
        {
            foreach (var texture in TextureCache.Values)
                if (texture != null) UnityEngine.Object.Destroy(texture);
            TextureCache.Clear();
            FontCache.Clear();
        }
    }
}
