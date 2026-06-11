using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace MuseLab.Export
{
    /// <summary>
    /// Fallback parser when JsonUtility cannot deserialize the full project.json shape.
    /// </summary>
    public static class ProjectManifestParser
    {
        public static ProjectManifest Parse(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            var manifest = new ProjectManifest
            {
                name = MatchString(json, "\"name\"\\s*:\\s*\"([^\"]+)\""),
                defaultLocale = MatchString(json, "\"defaultLocale\"\\s*:\\s*\"([^\"]+)\"") ?? "en",
                stories = ParseStories(json),
                assets = ParseAssets(json),
            };
            var width = MatchInt(json, "\"playerResolution\"\\s*:\\s*\\{[^}]*\"width\"\\s*:\\s*(\\d+)");
            var height = MatchInt(json, "\"playerResolution\"\\s*:\\s*\\{[^}]*\"height\"\\s*:\\s*(\\d+)");
            if (width > 0 && height > 0)
                manifest.playerResolution = new PlayerResolutionData { width = width, height = height };
            return manifest;
        }

        static AssetItem[] ParseAssets(string json)
        {
            var assets = new List<AssetItem>();
            var assetsIndex = json.IndexOf("\"assets\"", StringComparison.Ordinal);
            if (assetsIndex < 0) return Array.Empty<AssetItem>();
            var arrayStart = json.IndexOf('[', assetsIndex);
            var arrayEnd = FindMatchingBracket(json, arrayStart);
            if (arrayStart < 0 || arrayEnd < 0) return Array.Empty<AssetItem>();
            var assetsJson = json.Substring(arrayStart, arrayEnd - arrayStart + 1);
            
            // Match individual asset objects
            foreach (Match assetMatch in Regex.Matches(assetsJson, "\\{[^{}]*\"id\"\\s*:\\s*\"([^\"]+)\"[^{}]*\"url\"\\s*:\\s*\"([^\"]+)\"[^{}]*\\}", RegexOptions.Singleline))
            {
                assets.Add(new AssetItem
                {
                    id = assetMatch.Groups[1].Value,
                    url = assetMatch.Groups[2].Value
                });
            }
            return assets.ToArray();
        }

        static StoryManifest[] ParseStories(string json)
        {
            var stories = new List<StoryManifest>();
            foreach (Match storyMatch in Regex.Matches(json, "\\{\\s*\"id\"\\s*:\\s*\"([^\"]+)\"[^\\}]*\"name\"\\s*:\\s*\"([^\"]+)\"[^\\}]*\"entryNodeId\"\\s*:\\s*\"([^\"]+)\"", RegexOptions.Singleline))
            {
                var storyId = storyMatch.Groups[1].Value;
                var story = new StoryManifest
                {
                    id = storyId,
                    name = storyMatch.Groups[2].Value,
                    entryNodeId = storyMatch.Groups[3].Value,
                    nodes = ParseNodes(json, storyId),
                };
                stories.Add(story);
            }
            if (stories.Count == 0)
            {
                var id = MatchString(json, "\"stories\"\\s*:\\s*\\[\\s*\\{[^\\}]*\"id\"\\s*:\\s*\"([^\"]+)\"");
                if (!string.IsNullOrEmpty(id))
                {
                    stories.Add(new StoryManifest
                    {
                        id = id,
                        name = MatchString(json, "\"stories\"\\s*:\\s*\\[\\s*\\{[^\\}]*\"name\"\\s*:\\s*\"([^\"]+)\""),
                        entryNodeId = MatchString(json, "\"entryNodeId\"\\s*:\\s*\"([^\"]+)\""),
                        nodes = ParseNodes(json, id),
                    });
                }
            }
            return stories.ToArray();
        }

        static StoryNodeVisual[] ParseNodes(string json, string storyId)
        {
            var nodes = new List<StoryNodeVisual>();
            var storyPattern = $"\"id\"\\s*:\\s*\"{Regex.Escape(storyId)}\"";
            var storyIndex = Regex.Match(json, storyPattern).Index;
            if (storyIndex < 0) return Array.Empty<StoryNodeVisual>();
            var nodesIndex = json.IndexOf("\"nodes\"", storyIndex, StringComparison.Ordinal);
            if (nodesIndex < 0) return Array.Empty<StoryNodeVisual>();
            var arrayStart = json.IndexOf('[', nodesIndex);
            var arrayEnd = FindMatchingBracket(json, arrayStart);
            if (arrayStart < 0 || arrayEnd < 0) return Array.Empty<StoryNodeVisual>();
            var nodesJson = json.Substring(arrayStart, arrayEnd - arrayStart + 1);
            foreach (Match nodeMatch in Regex.Matches(nodesJson, "\\{[^{}]*\"id\"\\s*:\\s*\"([^\"]+)\"[^{}]*\"type\"\\s*:\\s*\"([^\"]+)\"[^{}]*?(?:\"backdropId\"\\s*:\\s*(\"[^\"]*\"|null))?", RegexOptions.Singleline))
            {
                var backdropRaw = nodeMatch.Groups[3].Value;
                string backdropId = null;
                if (!string.IsNullOrEmpty(backdropRaw) && backdropRaw != "null")
                    backdropId = backdropRaw.Trim('"');
                nodes.Add(new StoryNodeVisual
                {
                    id = nodeMatch.Groups[1].Value,
                    type = nodeMatch.Groups[2].Value,
                    backdropId = backdropId,
                    actorConfigs = Array.Empty<ActorConfigData>(),
                    soundConfigs = Array.Empty<SoundConfigData>(),
                });
            }
            return nodes.ToArray();
        }

        static int FindMatchingBracket(string json, int start)
        {
            if (start < 0 || start >= json.Length || json[start] != '[') return -1;
            var depth = 0;
            for (var i = start; i < json.Length; i++)
            {
                if (json[i] == '[') depth++;
                else if (json[i] == ']')
                {
                    depth--;
                    if (depth == 0) return i;
                }
            }
            return -1;
        }

        static string MatchString(string json, string pattern) =>
            Regex.Match(json, pattern).Success ? Regex.Match(json, pattern).Groups[1].Value : null;

        static int MatchInt(string json, string pattern) =>
            Regex.Match(json, pattern).Success && int.TryParse(Regex.Match(json, pattern).Groups[1].Value, out var v) ? v : 0;
    }
}
