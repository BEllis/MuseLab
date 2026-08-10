using System;
using System.Collections;
using UnityEngine;

namespace MuseLab.Scene
{
    public static class SceneTransitions
    {
        public static float ApplyEasing(float t)
        {
            t = Mathf.Clamp01(t);
            return t < 0.5f ? 2f * t * t : -1f + (4f - 2f * t) * t;
        }

        public static float Lerp(float from, float to, float t) => from + (to - from) * t;

        public static IEnumerator RunTween(float durationMs, Action<float> onUpdate)
        {
            if (durationMs <= 0f)
            {
                onUpdate?.Invoke(1f);
                yield break;
            }

            var duration = durationMs / 1000f;
            var elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                onUpdate?.Invoke(ApplyEasing(elapsed / duration));
                yield return null;
            }
            onUpdate?.Invoke(1f);
        }
    }
}
