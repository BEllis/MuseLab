using System.Collections.Generic;
using MuseLab.Audio;
using MuseLab.Bridge;
using MuseLab.Export;
using MuseLab.Playback;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace MuseLab.UI
{
    public class VNSceneController : MonoBehaviour
    {
        MuseLabEngine engine;
        UnityMuseLabRuntime runtime;
        UnityMuseLabFormat format;
        UnityMuseLabPromptRenderer prompter;
        SoundManager soundManager;
        PromptInstructionPlayer instructionPlayer;

        ExportContext export;
        RectTransform stageRoot;
        Image backdropImage;
        RectTransform actorRow;
        RectTransform choicePanel;
        RectTransform dialoguePanel;
        DialogueCaptionBox dialogueCaption;
        TMP_Text continueHint;
        RectTransform endScreen;
        Button restartButton;

        bool promptComplete = true;
        RuntimeState currentState;
        string entryNodeId;

        void Start()
        {
            MuseLabUiStyles.EnsureMainCamera(MuseLabUiStyles.StageBackground);
            export = MuseLabSession.Export;
            if (export == null)
            {
                Debug.LogError("VNScene started without export context. Load Splash scene first.");
                return;
            }

            EnsureEventSystem();
            BuildStageUi();
            InitializeEngine();
            ConfigureInstructionPlayer();
            RefreshScene();
        }

        void Update()
        {
            bool tapPressed = false;
            if (UnityEngine.InputSystem.Mouse.current != null && UnityEngine.InputSystem.Mouse.current.leftButton.wasPressedThisFrame)
            {
                tapPressed = true;
            }
            else if (UnityEngine.InputSystem.Touchscreen.current != null && UnityEngine.InputSystem.Touchscreen.current.primaryTouch.press.wasPressedThisFrame)
            {
                tapPressed = true;
            }

            if (tapPressed)
                HandleTap();
        }

        void EnsureEventSystem()
        {
            var es = FindAnyObjectByType<EventSystem>();
            if (es == null)
            {
                var esGo = new GameObject("EventSystem");
                es = esGo.AddComponent<EventSystem>();
            }

            var standalone = es.GetComponent<StandaloneInputModule>();
            if (standalone != null)
            {
                Destroy(standalone);
            }

            if (es.GetComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>() == null)
            {
                es.gameObject.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
            }
        }

        void InitializeEngine()
        {
            soundManager = gameObject.AddComponent<SoundManager>();
            soundManager.Initialize(export.RootPath);

            runtime = new UnityMuseLabRuntime();
            runtime.BindSoundManager(soundManager);
            format = new UnityMuseLabFormat();
            prompter = new UnityMuseLabPromptRenderer();
            runtime.BindInstructionRecorder(prompter.GetRecorder());

            engine = MuseLabEngine.Create(runtime, format, prompter, export.DefaultLocale);
            var storyId = export.Manifest.FindEntryStoryId();
            entryNodeId = export.Manifest.FindEntryNodeId(storyId)
                ?? MuseLabProjectData.GetStoryEntryNodeId(storyId);
            engine.Start();
        }

        void ConfigureInstructionPlayer()
        {
            instructionPlayer.Configure(
                soundManager,
                dialogueCaption.Dialogue,
                dialogueCaption.SpeakerText,
                SpeakerTemplateRenderer.Render,
                dialogueCaption.SetSpeaker);
            instructionPlayer.OnPlaybackComplete += OnPlaybackComplete;
        }

        void RefreshScene()
        {
            prompter.BeginRenderPass();
            currentState = engine.GetRuntimeState();
            if (TryAutoAdvanceFromStartNode())
                return;
            var instructions = new List<PromptInstruction>(prompter.GetInstructions());
            var node = export.Manifest.FindNode(currentState.GetActiveStoryId(), currentState.GetCurrentNodeId());

            ApplyBackdrop(node);
            ApplyActors(node);
            ApplyChoices(currentState);
            ApplyDialogue(currentState, instructions);

            var isEnded = currentState.GetIsEnded();
            endScreen.gameObject.SetActive(isEnded);
            stageRoot.gameObject.SetActive(!isEnded);
        }

        void ApplyBackdrop(StoryNodeVisual node)
        {
            backdropImage.sprite = null;
            backdropImage.color = MuseLabUiStyles.StageBackground;
            if (node == null || string.IsNullOrEmpty(node.backdropId)) return;
            var sprite = AssetLoader.LoadSprite(export.RootPath, node.backdropId);
            if (sprite == null) return;
            backdropImage.sprite = sprite;
            backdropImage.color = Color.white;
        }

        void ApplyActors(StoryNodeVisual node)
        {
            foreach (Transform child in actorRow)
                Destroy(child.gameObject);
            if (node?.actorConfigs == null) return;
            foreach (var actor in node.actorConfigs)
            {
                if (string.IsNullOrEmpty(actor.assetId)) continue;
                var sprite = AssetLoader.LoadSprite(export.RootPath, actor.assetId);
                if (sprite == null) continue;
                var go = new GameObject("Actor", typeof(RectTransform), typeof(Image));
                go.transform.SetParent(actorRow, false);
                var img = go.GetComponent<Image>();
                img.sprite = sprite;
                img.preserveAspect = true;
                var rt = go.GetComponent<RectTransform>();
                rt.sizeDelta = new Vector2(220, 360);
            }
        }

        void ApplyChoices(RuntimeState state)
        {
            foreach (Transform child in choicePanel)
                Destroy(child.gameObject);

            var count = state.GetChoiceCount();
            var hasOptions = false;
            for (var i = 0; i < count; i++)
            {
                var choice = state.GetChoice(i);
                if (!string.IsNullOrEmpty(choice.GetOptionText())) hasOptions = true;
            }

            var singleChoice = count == 1 && !hasOptions;
            continueHint.gameObject.SetActive(false);

            if (singleChoice && promptComplete)
            {
                continueHint.gameObject.SetActive(true);
                continueHint.text = "Continue ››";
                return;
            }

            if (count == 0) return;

            for (var i = 0; i < count; i++)
            {
                var choice = state.GetChoice(i);
                var label = string.IsNullOrEmpty(choice.GetOptionText())
                    ? $"Go to {choice.GetTargetNodeId()}"
                    : choice.GetOptionText();
                CreateChoiceButton(label, choice.GetTargetNodeId());
            }
        }

        void CreateChoiceButton(string label, string targetNodeId)
        {
            var go = new GameObject("Choice", typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(choicePanel, false);
            var img = go.GetComponent<Image>();
            img.color = MuseLabUiStyles.PanelBlue;
            var btn = go.GetComponent<Button>();
            btn.interactable = promptComplete;
            btn.onClick.AddListener(() => OnChoice(targetNodeId));
            var rt = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(500, 48);

            var textGo = new GameObject("Label", typeof(RectTransform), typeof(TextMeshProUGUI));
            textGo.transform.SetParent(go.transform, false);
            var text = textGo.GetComponent<TextMeshProUGUI>();
            text.text = label;
            text.fontSize = 18;
            text.color = MuseLabUiStyles.TextDark;
            text.richText = true;
            text.alignment = TextAlignmentOptions.MidlineLeft;
            TmpFontHelper.ApplyDefaultFont(text);
            var textRt = text.GetComponent<RectTransform>();
            Stretch(textRt);
            textRt.offsetMin = new Vector2(16, 0);
        }

        bool TryAutoAdvanceFromStartNode()
        {
            var storyId = currentState.GetActiveStoryId();
            var nodeId = currentState.GetCurrentNodeId();
            if (MuseLabProjectData.GetNodeKind(storyId, nodeId) != 0) return false;
            if (currentState.GetChoiceCount() != 1) return false;
            engine.GoToNode(currentState.GetChoice(0).GetTargetNodeId());
            RefreshScene();
            return true;
        }

        void ApplyDialogue(RuntimeState state, List<PromptInstruction> instructions)
        {
            var html = state.GetCurrentHtml() ?? "";
            var speaker = state.GetCurrentSpeaker() ?? "";
            var hasDialogue = DialoguePlainText.HasVisibleText(html) || DialoguePlainText.HasVisibleText(speaker);
            var singleImplicitContinue = state.GetChoiceCount() == 1
                && string.IsNullOrEmpty(state.GetChoice(0).GetOptionText());
            dialoguePanel.gameObject.SetActive(hasDialogue || singleImplicitContinue || state.GetIsTerminalScene());

            if (!hasDialogue)
            {
                promptComplete = true;
                return;
            }

            promptComplete = !PromptInstructionRules.NeedExecutor(instructions);
            instructionPlayer.Play(html, speaker, instructions);
        }

        void OnChoice(string targetNodeId)
        {
            if (!promptComplete) return;
            engine.GoToNode(targetNodeId);
            RefreshScene();
        }

        void HandleTap()
        {
            if (currentState == null) return;
            if (dialogueCaption.Dialogue.HasMoreToPaginate && !instructionPlayer.AwaitingContinue)
            {
                dialogueCaption.Dialogue.Paginate();
                return;
            }
            if (instructionPlayer.AwaitingContinue)
            {
                instructionPlayer.RequestContinue();
                return;
            }
            if (instructionPlayer.IsRevealing)
            {
                instructionPlayer.RequestSkipReveal();
                return;
            }
            if (!promptComplete) return;

            if (currentState.GetIsTerminalScene())
            {
                engine.FinishStory();
                RefreshScene();
                return;
            }

            var count = currentState.GetChoiceCount();
            if (count == 1)
            {
                var hasOptions = !string.IsNullOrEmpty(currentState.GetChoice(0).GetOptionText());
                if (!hasOptions)
                    OnChoice(currentState.GetChoice(0).GetTargetNodeId());
            }
        }

        void OnPlaybackComplete()
        {
            promptComplete = true;
            ApplyChoices(currentState);
            foreach (Transform child in choicePanel)
            {
                var btn = child.GetComponent<Button>();
                if (btn != null) btn.interactable = true;
            }
        }

        void OnRestart()
        {
            engine.StartStoryByIdAtNode(export.Manifest.FindEntryStoryId(), entryNodeId);
            RefreshScene();
        }

        void BuildStageUi()
        {
            var (width, height) = export.Manifest.GetPlayerResolution();
            var canvasGo = new GameObject("VNCanvas");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(width, height);
            canvasGo.AddComponent<GraphicRaycaster>();

            stageRoot = CreateRect(canvasGo.transform, "Stage");
            Stretch(stageRoot);

            backdropImage = CreateImage(stageRoot, "Backdrop", MuseLabUiStyles.StageBackground);
            Stretch(backdropImage.rectTransform);

            actorRow = CreateRect(stageRoot, "Actors");
            actorRow.anchorMin = new Vector2(0, 0);
            actorRow.anchorMax = new Vector2(1, 1);
            actorRow.offsetMin = new Vector2(32, MuseLabUiStyles.DialoguePanelHeight);
            actorRow.offsetMax = new Vector2(-32, -24);
            var layout = actorRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            layout.childAlignment = TextAnchor.LowerCenter;
            layout.spacing = 16;
            layout.childForceExpandWidth = false;

            choicePanel = CreateRect(stageRoot, "Choices");
            choicePanel.anchorMin = new Vector2(0.1f, 0.35f);
            choicePanel.anchorMax = new Vector2(0.9f, 0.75f);
            var choiceLayout = choicePanel.gameObject.AddComponent<VerticalLayoutGroup>();
            choiceLayout.spacing = 8;
            choiceLayout.childAlignment = TextAnchor.MiddleCenter;
            choiceLayout.childForceExpandWidth = true;

            dialoguePanel = CreateRect(stageRoot, "DialoguePanel");
            dialoguePanel.anchorMin = Vector2.zero;
            dialoguePanel.anchorMax = new Vector2(1, 0);
            dialoguePanel.pivot = new Vector2(0.5f, 0);
            dialoguePanel.offsetMin = Vector2.zero;
            dialoguePanel.offsetMax = new Vector2(0, MuseLabUiStyles.DialoguePanelHeight);
            var dialogueBg = dialoguePanel.gameObject.AddComponent<Image>();
            dialogueBg.sprite = UiSpriteFactory.CreateVerticalGradient(
                4,
                64,
                MuseLabUiStyles.DialoguePanelGradientBottom,
                MuseLabUiStyles.DialoguePanelGradientTop,
                0.7f,
                MuseLabUiStyles.DialoguePanelGradientMid);
            dialogueBg.type = Image.Type.Simple;

            dialogueCaption = DialogueCaptionBox.Create(dialoguePanel, export.RootPath);

            continueHint = CreateTmp(dialoguePanel, "ContinueHint", 16, TextAlignmentOptions.BottomRight);
            continueHint.color = MuseLabUiStyles.TextDark;
            continueHint.rectTransform.anchorMin = continueHint.rectTransform.anchorMax = new Vector2(1, 0);
            continueHint.rectTransform.anchoredPosition = new Vector2(-24, 16);
            continueHint.gameObject.SetActive(false);

            instructionPlayer = gameObject.AddComponent<PromptInstructionPlayer>();

            endScreen = CreateRect(canvasGo.transform, "EndScreen");
            Stretch(endScreen);
            var endBg = endScreen.gameObject.AddComponent<Image>();
            endBg.color = MuseLabUiStyles.StageBackground;
            var endTitle = CreateTmp(endScreen, "EndTitle", 42, TextAlignmentOptions.Center);
            endTitle.text = "The End";
            endTitle.rectTransform.anchorMin = endTitle.rectTransform.anchorMax = new Vector2(0.5f, 0.55f);

            restartButton = CreateButton(endScreen, "Restart", "Play again");
            restartButton.onClick.AddListener(OnRestart);
            var restartRt = restartButton.GetComponent<RectTransform>();
            restartRt.anchorMin = restartRt.anchorMax = new Vector2(0.5f, 0.4f);
            endScreen.gameObject.SetActive(false);
        }

        static RectTransform CreateRect(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go.GetComponent<RectTransform>();
        }

        static Image CreateImage(RectTransform parent, string name, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>();
            img.color = color;
            return img;
        }

        static TextMeshProUGUI CreateTmp(Transform parent, string name, float size, TextAlignmentOptions align)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
            go.transform.SetParent(parent, false);
            var text = go.GetComponent<TextMeshProUGUI>();
            text.fontSize = size;
            text.alignment = align;
            TmpFontHelper.ApplyDefaultFont(text);
            return text;
        }

        static Button CreateButton(Transform parent, string name, string label)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = MuseLabUiStyles.PanelBlue;
            var btn = go.GetComponent<Button>();
            var text = CreateTmp(go.transform, "Label", 20, TextAlignmentOptions.Center);
            text.text = label;
            text.color = MuseLabUiStyles.TextDark;
            Stretch(text.rectTransform);
            var rt = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(220, 48);
            return btn;
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }
}
