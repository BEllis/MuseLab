using System;
using System.Collections;
using MuseLab.Export;
using TMPro;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace MuseLab.UI
{
    public class MuseLabSplashController : MonoBehaviour
    {
        TextMeshProUGUI statusText;
        TextMeshProUGUI percentText;
        Image progressFill;
        TextMeshProUGUI errorText;

        IEnumerator Start()
        {
            MuseLabUiStyles.EnsureMainCamera(MuseLabUiStyles.SplashBackground);
            BuildUi();
            yield return LoadExport();
        }

        void BuildUi()
        {
            var canvasGo = new GameObject("SplashCanvas");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasGo.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvasGo.GetComponent<CanvasScaler>().referenceResolution = new Vector2(1280, 720);
            canvasGo.AddComponent<GraphicRaycaster>();

            var bg = CreateImage(canvasGo.transform, "Background", MuseLabUiStyles.SplashBackground);
            Stretch(bg.rectTransform);

            var panel = CreateImage(canvasGo.transform, "Panel", new Color(0.12f, 0.13f, 0.17f, 1f));
            panel.rectTransform.sizeDelta = new Vector2(480, 320);
            panel.rectTransform.anchorMin = panel.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            panel.rectTransform.anchoredPosition = Vector2.zero;

            var logo = CreateImage(panel.transform, "Logo", Color.white);
            logo.rectTransform.sizeDelta = new Vector2(220, 220);
            logo.rectTransform.anchorMin = logo.rectTransform.anchorMax = new Vector2(0.5f, 0.72f);
            logo.rectTransform.anchoredPosition = Vector2.zero;
            var logoSprite = Resources.Load<Sprite>("MuseLab/muselab-logo");
            if (logoSprite == null)
            {
                var tex = LoadLogoTexture();
                if (tex != null)
                    logo.sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
            }
            else logo.sprite = logoSprite;

            statusText = CreateText(panel.transform, "Status", 18, TextAlignmentOptions.Center);
            TmpFontHelper.ApplyDefaultFont(statusText);
            statusText.rectTransform.anchorMin = statusText.rectTransform.anchorMax = new Vector2(0.5f, 0.38f);
            statusText.rectTransform.sizeDelta = new Vector2(420, 40);
            statusText.text = "Loading MuseLab export…";

            var barBg = CreateImage(panel.transform, "ProgressBg", new Color(0.2f, 0.22f, 0.28f, 1f));
            barBg.rectTransform.sizeDelta = new Vector2(360, 10);
            barBg.rectTransform.anchorMin = barBg.rectTransform.anchorMax = new Vector2(0.5f, 0.28f);
            progressFill = CreateImage(barBg.transform, "ProgressFill", MuseLabUiStyles.BorderBlue);
            progressFill.type = Image.Type.Filled;
            progressFill.fillMethod = Image.FillMethod.Horizontal;
            progressFill.fillAmount = 0f;
            Stretch(progressFill.rectTransform);

            percentText = CreateText(panel.transform, "Percent", 14, TextAlignmentOptions.Center);
            TmpFontHelper.ApplyDefaultFont(percentText);
            percentText.color = new Color(0.65f, 0.68f, 0.75f);
            percentText.rectTransform.anchorMin = percentText.rectTransform.anchorMax = new Vector2(0.5f, 0.2f);
            percentText.rectTransform.sizeDelta = new Vector2(120, 30);

            errorText = CreateText(panel.transform, "Error", 14, TextAlignmentOptions.TopLeft);
            TmpFontHelper.ApplyDefaultFont(errorText);
            errorText.color = new Color(0.9f, 0.35f, 0.35f);
            errorText.rectTransform.anchorMin = new Vector2(0.05f, 0.05f);
            errorText.rectTransform.anchorMax = new Vector2(0.95f, 0.18f);
            errorText.gameObject.SetActive(false);
        }

        IEnumerator LoadExport()
        {
            var progress = new Progress<ExportLoadProgress>(p =>
            {
                if (statusText != null) statusText.text = p.Label;
                if (progressFill != null) progressFill.fillAmount = p.Fraction;
                if (percentText != null) percentText.text = $"{Mathf.RoundToInt(p.Fraction * 100)}%";
            });

            var task = ExportLoader.LoadAsync(progress);
            while (!task.IsCompleted) yield return null;

            if (task.IsFaulted)
            {
                errorText.gameObject.SetActive(true);
                errorText.text = task.Exception?.GetBaseException().Message ?? "Unknown export load error";
                statusText.text = "Failed to load export";
                yield break;
            }

            MuseLabSession.Export = task.Result;
            if (!Application.CanStreamedLevelBeLoaded("VNScene"))
                throw new InvalidOperationException("VNScene is not in Build Settings. Add Assets/MuseLab/Scenes/VNScene.unity.");
            SceneManager.LoadScene("VNScene");
        }

        static Texture2D LoadLogoTexture()
        {
            var path = System.IO.Path.Combine(Application.dataPath, "MuseLab/Art/muselab-logo.png");
            if (!System.IO.File.Exists(path)) return null;
            var bytes = System.IO.File.ReadAllBytes(path);
            var tex = new Texture2D(2, 2);
            return tex.LoadImage(bytes) ? tex : null;
        }

        static Image CreateImage(Transform parent, string name, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            var image = go.GetComponent<Image>();
            image.color = color;
            return image;
        }

        static TextMeshProUGUI CreateText(Transform parent, string name, float size, TextAlignmentOptions align)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
            go.transform.SetParent(parent, false);
            var text = go.GetComponent<TextMeshProUGUI>();
            text.fontSize = size;
            text.alignment = align;
            text.color = Color.white;
            TmpFontHelper.ApplyDefaultFont(text);
            return text;
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }
}
