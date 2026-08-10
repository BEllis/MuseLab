using System;
using System.Collections.Generic;

namespace MuseLab.Scene
{
    /// <summary>
    /// Reference counter for rendering assets. Unload only when the last user releases.
    /// </summary>
    public class AssetReferenceCounter
    {
        readonly Dictionary<string, int> counts = new();
        readonly Action<string> onLoad;
        readonly Action<string> onUnload;

        public AssetReferenceCounter(Action<string> onLoad = null, Action<string> onUnload = null)
        {
            this.onLoad = onLoad;
            this.onUnload = onUnload;
        }

        public static string Key(string assetId, string variationId = null) =>
            string.IsNullOrEmpty(variationId) ? assetId : $"{assetId}:{variationId}";

        public void Acquire(string key)
        {
            if (string.IsNullOrEmpty(key)) return;
            counts.TryGetValue(key, out var current);
            var next = current + 1;
            counts[key] = next;
            if (next == 1) onLoad?.Invoke(key);
        }

        public void Release(string key)
        {
            if (string.IsNullOrEmpty(key) || !counts.TryGetValue(key, out var current)) return;
            if (current <= 1)
            {
                counts.Remove(key);
                onUnload?.Invoke(key);
                return;
            }
            counts[key] = current - 1;
        }

        public bool IsLoaded(string key) => counts.ContainsKey(key);

        public List<string> LoadedKeys()
        {
            var keys = new List<string>(counts.Keys);
            keys.Sort(StringComparer.Ordinal);
            return keys;
        }

        public void ReleaseAll()
        {
            foreach (var key in new List<string>(counts.Keys))
            {
                counts.Remove(key);
                onUnload?.Invoke(key);
            }
        }
    }
}
