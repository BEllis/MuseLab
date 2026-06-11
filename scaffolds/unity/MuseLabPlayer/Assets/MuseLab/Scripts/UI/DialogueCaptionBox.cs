using MuseLab.Playback;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace MuseLab.UI
{
    public class DialogueCaptionBox : MonoBehaviour
    {
        GameObject speakerRoot;
        RoundedBorderImage dialogueBoxBorder;
        TMP_Text speakerText;
        TMP_Text dialogueText;

        public TMP_Text DialogueText => dialogueText;
        public TMP_Text SpeakerText => speakerText;

        public static DialogueCaptionBox Create(RectTransform parent)
        {
            var rootGo = new GameObject("DialogueCaption", typeof(RectTransform), typeof(DialogueCaptionBox));
            rootGo.transform.SetParent(parent, false);
            var root = rootGo.GetComponent<RectTransform>();
            Stretch(root);
            var box = rootGo.GetComponent<DialogueCaptionBox>();
            box.Build(root);
            return box;
        }

        void Build(RectTransform root)
        {
            var column = CreateRect(root, "Column");
            var columnRt = column.GetComponent<RectTransform>();
            Stretch(columnRt);
            columnRt.offsetMin = new Vector2(MuseLabUiStyles.DialoguePanelPaddingHorizontal, MuseLabUiStyles.DialoguePanelPaddingBottom);
            columnRt.offsetMax = new Vector2(-MuseLabUiStyles.DialoguePanelPaddingHorizontal, -MuseLabUiStyles.DialoguePanelPaddingTop);

            var layout = column.AddComponent<VerticalLayoutGroup>();
            layout.childAlignment = TextAnchor.LowerLeft;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            layout.spacing = -2f;

            speakerRoot = BuildSpeakerTab(column.transform);
            var dialogueBox = BuildDialogueBox(column.transform);
            dialogueBoxBorder = dialogueBox.GetComponent<RoundedBorderImage>();
        }

        GameObject BuildSpeakerTab(Transform parent)
        {
            var rowGo = new GameObject("SpeakerRow", typeof(RectTransform), typeof(HorizontalLayoutGroup), typeof(LayoutElement));
            rowGo.transform.SetParent(parent, false);
            var rowLayout = rowGo.GetComponent<HorizontalLayoutGroup>();
            rowLayout.padding = new RectOffset((int)MuseLabUiStyles.SpeakerTabMarginLeft, 0, 0, 0);
            rowLayout.childAlignment = TextAnchor.LowerLeft;
            rowLayout.childControlWidth = true;
            rowLayout.childControlHeight = true;
            rowLayout.childForceExpandWidth = false;
            rowLayout.childForceExpandHeight = false;

            var rowElement = rowGo.GetComponent<LayoutElement>();
            rowElement.minHeight = MuseLabUiStyles.SpeakerTabHeight;
            rowElement.preferredHeight = MuseLabUiStyles.SpeakerTabHeight;

            var tabGo = new GameObject("SpeakerTab", typeof(RectTransform), typeof(Image), typeof(LayoutElement), typeof(HorizontalLayoutGroup));
            tabGo.transform.SetParent(rowGo.transform, false);

            var layoutElement = tabGo.GetComponent<LayoutElement>();
            layoutElement.minHeight = MuseLabUiStyles.SpeakerTabHeight;
            layoutElement.preferredHeight = MuseLabUiStyles.SpeakerTabHeight;
            layoutElement.flexibleWidth = 0;

            var tabRt = tabGo.GetComponent<RectTransform>();
            tabRt.pivot = new Vector2(0, 0);

            var hlg = tabGo.GetComponent<HorizontalLayoutGroup>();
            hlg.padding = new RectOffset(14, 14, 4, 4);
            hlg.childAlignment = TextAnchor.MiddleLeft;
            hlg.childControlWidth = true;
            hlg.childControlHeight = true;
            hlg.childForceExpandWidth = false;
            hlg.childForceExpandHeight = true;

            var tabImage = tabGo.GetComponent<Image>();
            RoundedBorderImage.Apply(tabImage).SetStyle(
                MuseLabUiStyles.PanelBlue,
                MuseLabUiStyles.BorderBlue,
                MuseLabUiStyles.BorderWidth,
                RoundedBorderImage.CornerRadii(MuseLabUiStyles.CornerRadius, MuseLabUiStyles.CornerRadius, 0, 0),
                RoundedBorderImage.BorderSidesAll);

            var speakerTextGo = new GameObject("SpeakerText", typeof(RectTransform), typeof(TextMeshProUGUI), typeof(LayoutElement));
            speakerTextGo.transform.SetParent(tabGo.transform, false);
            speakerText = speakerTextGo.GetComponent<TextMeshProUGUI>();
            speakerText.fontSize = MuseLabUiStyles.SpeakerFontSize;
            speakerText.color = MuseLabUiStyles.BorderBlue;
            speakerText.richText = true;
            speakerText.alignment = TextAlignmentOptions.MidlineLeft;
            speakerText.textWrappingMode = TextWrappingModes.NoWrap;
            speakerText.overflowMode = TextOverflowModes.Overflow;
            TmpFontHelper.ApplyDefaultFont(speakerText);

            var textLayout = speakerTextGo.GetComponent<LayoutElement>();
            textLayout.flexibleWidth = 0;

            var fitter = tabGo.AddComponent<ContentSizeFitter>();
            fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            fitter.verticalFit = ContentSizeFitter.FitMode.Unconstrained;

            rowGo.SetActive(false);
            return rowGo;
        }

        GameObject BuildDialogueBox(Transform parent)
        {
            var boxGo = new GameObject("DialogueBox", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
            boxGo.transform.SetParent(parent, false);

            var boxLayout = boxGo.GetComponent<LayoutElement>();
            boxLayout.minHeight = MuseLabUiStyles.DialogueBoxHeight;
            boxLayout.preferredHeight = MuseLabUiStyles.DialogueBoxHeight;
            boxLayout.flexibleHeight = 0;

            var boxImage = boxGo.GetComponent<Image>();
            dialogueBoxBorder = RoundedBorderImage.Apply(boxImage);
            dialogueBoxBorder.SetStyle(
                MuseLabUiStyles.PanelBlue,
                MuseLabUiStyles.BorderBlue,
                MuseLabUiStyles.BorderWidth,
                RoundedBorderImage.CornerRadii(
                    MuseLabUiStyles.CornerRadius,
                    MuseLabUiStyles.CornerRadius,
                    MuseLabUiStyles.CornerRadius,
                    MuseLabUiStyles.CornerRadius),
                RoundedBorderImage.BorderSidesAll);

            var viewportGo = new GameObject("Viewport", typeof(RectTransform), typeof(RectMask2D));
            viewportGo.transform.SetParent(boxGo.transform, false);
            var viewportRt = viewportGo.GetComponent<RectTransform>();
            Stretch(viewportRt);
            viewportRt.offsetMin = new Vector2(20, 16);
            viewportRt.offsetMax = new Vector2(-20, -16);

            var dialogueGo = new GameObject("DialogueText", typeof(RectTransform), typeof(TextMeshProUGUI));
            dialogueGo.transform.SetParent(viewportGo.transform, false);
            dialogueText = dialogueGo.GetComponent<TextMeshProUGUI>();
            dialogueText.fontSize = MuseLabUiStyles.DialogueFontSize;
            dialogueText.lineSpacing = MuseLabUiStyles.DialogueLineSpacing;
            dialogueText.color = MuseLabUiStyles.TextDark;
            dialogueText.alignment = TextAlignmentOptions.BottomLeft;
            dialogueText.textWrappingMode = TextWrappingModes.Normal;
            dialogueText.overflowMode = TextOverflowModes.Truncate;
            dialogueText.richText = true;
            TmpFontHelper.ApplyDefaultFont(dialogueText);
            dialogueGo.AddComponent<ShakeTextEffect>();

            var dialogueRt = dialogueGo.GetComponent<RectTransform>();
            Stretch(dialogueRt);

            return boxGo;
        }

        public void SetSpeaker(string speaker)
        {
            var hasSpeaker = !string.IsNullOrWhiteSpace(MarkupUtil.StripTags(speaker));
            speakerRoot.SetActive(hasSpeaker);
            speakerText.text = hasSpeaker ? speaker : string.Empty;
        }

        static GameObject CreateRect(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go;
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }
}
