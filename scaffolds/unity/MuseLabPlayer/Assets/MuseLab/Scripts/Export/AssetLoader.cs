using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace MuseLab.Export
{
    public static class AssetLoader
    {
        static readonly Dictionary<string, Texture2D> TextureCache = new();
        static readonly Dictionary<string, object> FontCache = new();

        public static Texture2D LoadTexture(string exportRoot, string assetId)
        {
            if (string.IsNullOrEmpty(assetId)) return null;
            if (TextureCache.TryGetValue(assetId, out var cached)) return cached;

            byte[] bytes = null;

            var archivePath = MuseLabProjectData.GetAssetArchivePath(assetId);
            var diskPath = ExportLoader.ResolveArchivePath(exportRoot, archivePath);
            if (File.Exists(diskPath))
            {
                bytes = File.ReadAllBytes(diskPath);
            }
            else
            {
                Debug.LogWarning($"Texture asset not found on disk: {diskPath}. Trying base64 fallback from project manifest.");
                if (MuseLabSession.Export != null && MuseLabSession.Export.Manifest != null && MuseLabSession.Export.Manifest.assets != null)
                {
                    foreach (var asset in MuseLabSession.Export.Manifest.assets)
                    {
                        if (asset.id == assetId)
                        {
                            if (!string.IsNullOrEmpty(asset.url) && asset.url.StartsWith("data:image/") && asset.url.Contains("base64,"))
                            {
                                try
                                {
                                    var base64Part = asset.url.Substring(asset.url.IndexOf("base64,") + 7);
                                    bytes = Convert.FromBase64String(base64Part);
                                    Debug.Log($"Successfully parsed embedded base64 fallback for asset: {assetId}");
                                }
                                catch (Exception ex)
                                {
                                    Debug.LogError($"Failed to parse base64 for asset {assetId}: {ex.Message}");
                                }
                            }
                            break;
                        }
                    }
                }
            }

            if (bytes == null)
            {
                Debug.LogError($"Could not load texture bytes for asset: {assetId}");
                return null;
            }

            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            if (!texture.LoadImage(bytes))
            {
                Debug.LogWarning($"Failed to decode texture bytes for asset: {assetId}");
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

        public static void ClearCache()
        {
            foreach (var texture in TextureCache.Values)
                if (texture != null) UnityEngine.Object.Destroy(texture);
            TextureCache.Clear();
            FontCache.Clear();
        }
    }
}
