using UnityEngine;

namespace MuseLab.UI
{
    public static class UiSpriteFactory
    {
        public static Sprite CreateRoundedRect(
            int width,
            int height,
            int radius,
            Color fill,
            Color? border = null,
            int borderWidth = 0,
            bool roundTopLeft = true,
            bool roundTopRight = true,
            bool roundBottomLeft = true,
            bool roundBottomRight = true)
        {
            var texture = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
            };

            var pixels = new Color[width * height];
            var r = Mathf.Min(radius, Mathf.Min(width, height) / 2);
            var bw = Mathf.Max(0, borderWidth);
            var borderColor = border ?? Color.clear;

            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                {
                    var inside = InsideRoundedRect(x, y, width, height, r, roundTopLeft, roundTopRight, roundBottomLeft, roundBottomRight);
                    if (!inside)
                    {
                        pixels[y * width + x] = Color.clear;
                        continue;
                    }

                    if (bw > 0 && borderColor.a > 0)
                    {
                        var inner = InsideRoundedRect(
                            x,
                            y,
                            width,
                            height,
                            Mathf.Max(0, r - bw),
                            roundTopLeft,
                            roundTopRight,
                            roundBottomLeft,
                            roundBottomRight,
                            bw);
                        pixels[y * width + x] = inner ? fill : borderColor;
                    }
                    else
                    {
                        pixels[y * width + x] = fill;
                    }
                }
            }

            texture.SetPixels(pixels);
            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, width, height), new Vector2(0.5f, 0.5f), 100f);
        }

        public static Sprite CreateVerticalGradient(int width, int height, Color bottom, Color top, float midStop = 0.7f, Color? mid = null)
        {
            var texture = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
            };
            var pixels = new Color[width * height];
            var midColor = mid ?? Color.Lerp(bottom, top, midStop);
            for (var y = 0; y < height; y++)
            {
                var t = height <= 1 ? 1f : y / (float)(height - 1);
                var color = t <= midStop
                    ? Color.Lerp(bottom, midColor, t / Mathf.Max(midStop, 0.001f))
                    : Color.Lerp(midColor, top, (t - midStop) / Mathf.Max(1f - midStop, 0.001f));
                for (var x = 0; x < width; x++)
                    pixels[y * width + x] = color;
            }
            texture.SetPixels(pixels);
            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, width, height), new Vector2(0.5f, 0.5f), 100f);
        }

        static bool InsideRoundedRect(
            int x,
            int y,
            int width,
            int height,
            int radius,
            bool roundTopLeft,
            bool roundTopRight,
            bool roundBottomLeft,
            bool roundBottomRight,
            int inset = 0)
        {
            var left = inset;
            var right = width - 1 - inset;
            var bottom = inset;
            var top = height - 1 - inset;

            if (x < left || x > right || y < bottom || y > top) return false;

            if (roundBottomLeft && x < left + radius && y < bottom + radius)
                return Vector2.Distance(new Vector2(x, y), new Vector2(left + radius, bottom + radius)) <= radius;
            if (roundBottomRight && x > right - radius && y < bottom + radius)
                return Vector2.Distance(new Vector2(x, y), new Vector2(right - radius, bottom + radius)) <= radius;
            if (roundTopLeft && x < left + radius && y > top - radius)
                return Vector2.Distance(new Vector2(x, y), new Vector2(left + radius, top - radius)) <= radius;
            if (roundTopRight && x > right - radius && y > top - radius)
                return Vector2.Distance(new Vector2(x, y), new Vector2(right - radius, top - radius)) <= radius;

            return true;
        }
    }
}
