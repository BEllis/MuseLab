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
        RectTransform viewport;
        RectTransform textRect;

        string currentMarkup = "";
        string previousMarkup = "";
        float[] lineOffsets = { 0f };
        float contentHeight;
        int startLineIndex;
        bool showMoreHint;
        bool showContinueHint;

        public bool Compact { get; set; }

        public TMP_Text VisibleText => visibleText;
        public IReadOnlyList<DialogueGlyph> Glyphs => document.Glyphs;

        public int LineCount => lineOffsets?.Length ?? 0;

        public DialoguePlaybackGate PlaybackGate { get; private set; }

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
        }

        static void ConfigureTmp(TMP_Text tmp)
        {
            tmp.fontSize = MuseLabUiStyles.DialogueFontSize;
            tmp.lineSpacing = MuseLabUiStyles.DialogueLineSpacing;
            tmp.color = MuseLabUiStyles.TextDark;
            tmp.alignment = TextAlignmentOptions.BottomLeft;
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

            var tmpString = tmpRenderer.BuildTmpString(document.Glyphs);
            measureText.text = tmpString;
            visibleText.text = showMoreHint || showContinueHint
                ? DialogueLayoutEngine.AppendInlineDialogueMoreHint(tmpString)
                : tmpString;
            measureText.ForceMeshUpdate();
            visibleText.ForceMeshUpdate();

            RemeasureLayout();
            ApplyPageOffset();
            glyphEffects.Configure(visibleText, document.Glyphs, Compact);
        }

        public void SetShowMoreHint(bool show)
        {
            showMoreHint = show;
            RefreshHintDisplay();
        }

        public void SetShowContinueHint(bool show)
        {
            showContinueHint = show;
            RefreshHintDisplay();
        }

        void RefreshHintDisplay()
        {
            if (string.IsNullOrEmpty(currentMarkup)) return;
            var tmpString = tmpRenderer.BuildTmpString(document.Glyphs);
            visibleText.text = showMoreHint || showContinueHint
                ? DialogueLayoutEngine.AppendInlineDialogueMoreHint(tmpString)
                : tmpString;
        }

        public void OnRevealStarted()
        {
            var viewportHeight = GetContentViewportHeight();
            startLineIndex = DialogueLayoutEngine.GetLastPageStartLine(lineOffsets, contentHeight, viewportHeight, startLineIndex);
            ApplyPageOffset();
        }

        public void OnRevealEnded() { }

        public bool Paginate()
        {
            if (!HasMoreToPaginate) return false;
            var viewportHeight = GetContentViewportHeight();
            var (linesOnPage, _) = DialogueLayoutEngine.GetDialoguePageState(lineOffsets, contentHeight, startLineIndex, viewportHeight);
            startLineIndex += linesOnPage;
            ApplyPageOffset();
            return true;
        }

        public int LineCountAtHtml(string markup)
        {
            var saved = currentMarkup;
            SetMarkup(markup);
            var count = LineCount;
            SetMarkup(saved);
            return count;
        }

        void RemeasureLayout()
        {
            lineOffsets = DialogueLayoutEngine.MeasureLineBaselines(measureText);
            contentHeight = DialogueLayoutEngine.ContentHeight(lineOffsets, measureText);
            PlaybackGate = new DialoguePlaybackGate
            {
                TotalVisualLines = lineOffsets.Length,
                MeasuredForHtmlLength = currentMarkup.Length,
            };
        }

        float GetContentViewportHeight()
        {
            if (viewport == null) return 0f;
            var height = viewport.rect.height;
            var hintReserve = (showContinueHint || showMoreHint) ? DialogueLayoutEngine.DialogueHintReservePx : 0f;
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
            textRect.anchoredPosition = new Vector2(0f, -(offset - baseLine));
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }
}
