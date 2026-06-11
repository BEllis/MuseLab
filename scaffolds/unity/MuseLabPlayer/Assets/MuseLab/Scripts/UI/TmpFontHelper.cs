using TMPro;
using UnityEngine;

namespace MuseLab.UI
{
    public static class TmpFontHelper
    {
        static TMP_FontAsset cached;

        public static void ApplyDefaultFont(TMP_Text text)
        {
            if (text == null) return;
            cached ??= Resources.Load<TMP_FontAsset>("Fonts & Materials/LiberationSans SDF");
            if (cached != null) text.font = cached;
        }
    }
}
