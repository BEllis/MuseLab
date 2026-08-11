using System.Collections.Generic;
using MuseLab.Export;
using TMPro;
using UnityEngine;

namespace MuseLab.UI.Dialogue
{
    public class MuseLabDialogueText : MonoBehaviour, IDialogueTextView
    {
        readonly DialogueDocument document = new();
        readonly DialogueMarkupParser parser = new();

        DialogueTmpRenderer tmpRenderer;
        DialogueGlyphEffects glyphEffects;
        DialogueFontRegistry fontRegistry;

        TMP_Text measureText;
        TMP_Text visibleText;
        TMP_Text continueHint;
        RectTransform viewport;
        RectTransform textRect;

        string currentMarkup = "";
        string previousMarkup = "";
        float[] lineOffsets = { 0f };
        float contentHeight;
        int startLineIndex;
        bool showContinueHint;

        public bool Compact { get; set; }

        public TMP_Text VisibleText => visibleText;
        public IReadOnlyList<DialogueGlyph> Glyphs => document.Glyphs;

        public bool HasMoreToPaginate
        {
            get
            {
                var viewportHeight = GetContentViewportHeight();
                var (_, hasMore) = DialogueLayoutEngine.GetDialoguePageState(lineOffsets, contentHeight, startLineIndex, viewportHeight);
                return hasMore;
            }
        }

        public static MuseLabDialogueText Create(RectTransform parent, string exportRoot = null)
        {
            var rootGo = new GameObject("MuseLabDialogueText", typeof(RectTransform), typeof(MuseLabDialogueText));
            rootGo.transform.SetParent(parent, false);
            var rt = rootGo.GetComponent<RectTransform>();
            Stretch(rt);
            var component = rootGo.GetComponent<MuseLabDialogueText>();
            component.Initialize(exportRoot);
            return component;
        }

        void Initialize(string exportRoot)
        {
            if (!string.IsNullOrEmpty(exportRoot))
                fontRegistry = new DialogueFontRegistry(exportRoot);
            tmpRenderer = new DialogueTmpRenderer(fontRegistry);

            viewport = GetComponent<RectTransform>();

            var measureGo = new GameObject("Measure", typeof(RectTransform), typeof(TextMeshProUGUI), typeof(CanvasGroup));
            measureGo.transform.SetParent(transform, false);
            var measureRt = measureGo.GetComponent<RectTransform>();
            Stretch(measureRt);
            measureText = measureGo.GetComponent<TextMeshProUGUI>();
            ConfigureTmp(measureText);
            var measureCanvas = measureGo.GetComponent<CanvasGroup>();
            measureCanvas.alpha = 0f;
            measureCanvas.blocksRaycasts = false;
            measureCanvas.interactable = false;

            var visibleGo = new GameObject("Visible", typeof(RectTransform), typeof(TextMeshProUGUI));
            visibleGo.transform.SetParent(transform, false);
            visibleText = visibleGo.GetComponent<TextMeshProUGUI>();
            ConfigureTmp(visibleText);
            textRect = visibleGo.GetComponent<RectTransform>();
            Stretch(textRect);

            glyphEffects = visibleGo.AddComponent<DialogueGlyphEffects>();

            var hintGo = new GameObject("ContinueHint", typeof(RectTransform), typeof(TextMeshProUGUI));
            hintGo.transform.SetParent(transform, false);
            continueHint = hintGo.GetComponent<TextMeshProUGUI>();
            continueHint.fontSize = 13;
            continueHint.color = MuseLabUiStyles.TextDark;
            continueHint.alignment = TextAlignmentOptions.BottomRight;
            continueHint.text = "Continue ››";
            continueHint.raycastTarget = false;
            continueHint.richText = false;
            TmpFontHelper.ApplyDefaultFont(continueHint);
            var hintRt = hintGo.GetComponent<RectTransform>();
            hintRt.anchorMin = hintRt.anchorMax = new Vector2(1f, 0f);
            hintRt.pivot = new Vector2(1f, 0f);
            hintRt.anchoredPosition = new Vector2(-4f, 2f);
            hintRt.sizeDelta = new Vector2(140f, 22f);
            hintGo.SetActive(false);
        }

        static void ConfigureTmp(TMP_Text tmp)
        {
            tmp.fontSize = MuseLabUiStyles.DialogueFontSize;
            tmp.lineSpacing = MuseLabUiStyles.DialogueLineSpacing;
            tmp.color = MuseLabUiStyles.TextDark;
            tmp.alignment = TextAlignmentOptions.TopLeft;
            tmp.textWrappingMode = TextWrappingModes.Normal;
            tmp.overflowMode = TextOverflowModes.Overflow;
            tmp.richText = true;
            TmpFontHelper.ApplyDefaultFont(tmp);
        }

        public void SetMarkup(string markup)
        {
            currentMarkup = markup ?? "";
            if (DialogueLayoutEngine.ShouldResetDialogueLinePage(previousMarkup, currentMarkup))
                startLineIndex = 0;
            previousMarkup = currentMarkup;

            fontRegistry?.PreloadFromMarkup(currentMarkup);
            document.BuildFromMarkup(currentMarkup, parser);

            RemeasureLayout();
            RefreshHintDisplay();
            ApplyPageOffset();
            glyphEffects.Configure(visibleText, document.Glyphs, Compact);
        }

        public void SetShowContinueHint(bool show)
        {
            showContinueHint = show;
            RefreshHintDisplay();
        }

        void RefreshHintDisplay()
        {
            if (continueHint != null)
                continueHint.gameObject.SetActive(showContinueHint);
            if (string.IsNullOrEmpty(currentMarkup)) return;
            var tmpString = tmpRenderer.BuildTmpString(document.Glyphs);
            visibleText.text = tmpString;
            visibleText.ForceMeshUpdate();
        }

        public void OnRevealStarted()
        {
            var viewportHeight = GetContentViewportHeight();
            startLineIndex = DialogueLayoutEngine.GetLastPageStartLine(lineOffsets, contentHeight, viewportHeight, startLineIndex);
            ApplyPageOffset();
            RefreshHintDisplay();
        }

        public void OnRevealEnded()
        {
            RefreshHintDisplay();
        }

        public bool Paginate()
        {
            if (!HasMoreToPaginate) return false;
            var viewportHeight = GetContentViewportHeight();
            var (linesOnPage, _) = DialogueLayoutEngine.GetDialoguePageState(lineOffsets, contentHeight, startLineIndex, viewportHeight);
            startLineIndex += linesOnPage;
            ApplyPageOffset();
            RefreshHintDisplay();
            return true;
        }

        void RemeasureLayout()
        {
            var tmpString = tmpRenderer.BuildTmpString(document.Glyphs);
            measureText.text = tmpString;
            measureText.ForceMeshUpdate();
            lineOffsets = DialogueLayoutEngine.MeasureLineBaselines(measureText);
            contentHeight = DialogueLayoutEngine.ContentHeight(lineOffsets, measureText);
        }

        float GetContentViewportHeight()
        {
            if (viewport == null) return 0f;
            var height = viewport.rect.height;
            var hintReserve = showContinueHint ? DialogueLayoutEngine.DialogueHintReservePx : 0f;
            return DialogueLayoutEngine.DialogueContentHeightPx(height, hintReserve);
        }

        void ApplyPageOffset()
        {
            if (textRect == null || lineOffsets == null || lineOffsets.Length == 0)
            {
                if (textRect != null) textRect.anchoredPosition = Vector2.zero;
                return;
            }

            var clampedStart = DialogueLayoutEngine.ClampDialogueStartLine(lineOffsets, startLineIndex);
            var offset = clampedStart < lineOffsets.Length ? lineOffsets[clampedStart] : 0f;
            var baseLine = lineOffsets[0];
            var standardY = -(offset - baseLine);

            var lastLineIndex = lineOffsets.Length - 1;
            var lastLineBaseline = lineOffsets[lastLineIndex];
            var startLineBaseline = lineOffsets[clampedStart];
            var lineHeight = visibleText.fontSize * 1.6f;
            var blockHeight = (startLineBaseline - lastLineBaseline) + lineHeight;

            var viewportHeight = GetContentViewportHeight();

            if (blockHeight > viewportHeight)
            {
                var scrollUp = blockHeight - viewportHeight;
                textRect.anchoredPosition = new Vector2(0f, standardY + scrollUp);
            }
            else
            {
                textRect.anchoredPosition = new Vector2(0f, standardY);
            }
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }
}
