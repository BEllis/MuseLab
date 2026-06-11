using UnityEngine;

namespace MuseLab.UI
{
    public static class MuseLabUiStyles
    {
        public static readonly Color StageBackground = new(0.04f, 0.04f, 0.07f, 1f);
        public static readonly Color PanelBlue = new(0.77f, 0.87f, 0.94f, 1f);
        public static readonly Color BorderBlue = new(0.12f, 0.35f, 0.54f, 1f);
        public static readonly Color TextDark = new(0.06f, 0.09f, 0.16f, 1f);
        public static readonly Color SplashBackground = new(0.08f, 0.09f, 0.12f, 1f);
        public static readonly Color DialoguePanelGradientBottom = new(0f, 0f, 0f, 0.92f);
        public static readonly Color DialoguePanelGradientMid = new(0f, 0f, 0f, 0.6f);
        public static readonly Color DialoguePanelGradientTop = new(0f, 0f, 0f, 0f);
        public const float DialoguePanelHeight = 220f;
        public const float DialoguePanelPaddingHorizontal = 24f;
        public const float DialoguePanelPaddingTop = 16f;
        public const float DialoguePanelPaddingBottom = 24f;
        public const float SpeakerTabMarginLeft = 12f;
        public const float DialogueBoxHeight = 144f;
        public const float SpeakerTabHeight = 28f;
        public const float SpeakerFontSize = 14f;
        public const float DialogueFontSize = 16f;
        public const float DialogueLineSpacing = 9.6f;
        public const float BorderWidth = 4f;
        public const float CornerRadius = 12f;

        public static void EnsureMainCamera(Color background)
        {
            if (Camera.main != null) return;

            var cameraGo = new GameObject("Main Camera");
            cameraGo.tag = "MainCamera";
            var camera = cameraGo.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = background;
            camera.orthographic = true;
            camera.orthographicSize = 5f;
            camera.nearClipPlane = 0.3f;
            camera.farClipPlane = 1000f;
            cameraGo.AddComponent<AudioListener>();
        }
    }
}
