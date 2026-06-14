using System;
using System.Collections;
using System.Collections.Generic;
using MuseLab.Audio;
using MuseLab.UI.Dialogue;
using TMPro;
using UnityEngine;

namespace MuseLab.Playback
{
    public class PromptInstructionPlayer : MonoBehaviour
    {
        public event Action<bool> OnPlaybackStateChanged;
        public event Action OnPlaybackComplete;

        SoundManager soundManager;
        IDialogueTextView dialogueView;
        TMP_Text speakerText;
        Func<string, string> renderSpeakerTemplate;
        Action<string> onSpeakerChanged;

        string visibleMarkup = "";
        string visibleSpeaker = "";
        string fullMarkupSnapshot = "";
        IReadOnlyList<PromptInstruction> activeInstructions = Array.Empty<PromptInstruction>();

        bool awaitingContinue;
        bool isRevealing;
        bool skipRevealRequested;
        bool skipLatchActive;
        int linesAtLastContinue;
        int continuationLineInterval = PromptInstructionRules.DefaultContinuationVisualLineInterval;

        PromptExecutionCheckpoint checkpoint;

        public bool IsComplete { get; private set; } = true;
        public bool AwaitingContinue => awaitingContinue;
        public bool IsRevealing => isRevealing;
        public string VisibleMarkup => visibleMarkup;
        public string VisibleSpeaker => visibleSpeaker;

        public void Configure(
            SoundManager sound,
            IDialogueTextView dialogue,
            TMP_Text speaker,
            Func<string, string> speakerRenderer,
            Action<string> onSpeakerChanged = null)
        {
            soundManager = sound;
            dialogueView = dialogue;
            speakerText = speaker;
            renderSpeakerTemplate = speakerRenderer;
            this.onSpeakerChanged = onSpeakerChanged;
        }

        public void StopPlayback()
        {
            StopAllCoroutines();
            isRevealing = false;
            awaitingContinue = false;
            skipLatchActive = false;
            dialogueView?.SetShowMoreHint(false);
            dialogueView?.SetShowContinueHint(false);
            dialogueView?.OnRevealEnded();
        }

        public void RequestContinue()
        {
            if (awaitingContinue) awaitingContinue = false;
        }

        public void RequestSkipReveal()
        {
            skipRevealRequested = true;
        }

        public void RequestSkipAll(string fullMarkup, string finalSpeaker)
        {
            StopPlayback();
            visibleMarkup = fullMarkup ?? "";
            visibleSpeaker = finalSpeaker ?? "";
            foreach (var instruction in activeInstructions)
            {
                if (instruction.Kind == PromptInstructionKind.PlaySound && soundManager != null)
                    soundManager.PlayDelayed(instruction.AssetId, instruction.DelaySeconds, instruction.StartTime, instruction.EndTime);
            }
            ApplyText();
            IsComplete = true;
            OnPlaybackComplete?.Invoke();
        }

        public PromptExecutionCheckpoint SaveCheckpoint(int instructionIndex, int revealStep = 0)
        {
            checkpoint = new PromptExecutionCheckpoint
            {
                InstructionIndex = instructionIndex,
                VisibleMarkup = visibleMarkup,
                VisibleSpeaker = visibleSpeaker,
                RevealStep = revealStep,
            };
            return checkpoint;
        }

        public void Play(string fullMarkup, string initialSpeaker, IReadOnlyList<PromptInstruction> instructions)
        {
            StopPlayback();
            fullMarkupSnapshot = fullMarkup ?? "";
            activeInstructions = instructions ?? Array.Empty<PromptInstruction>();

            if (!PromptInstructionRules.NeedExecutor(instructions))
            {
                visibleMarkup = fullMarkupSnapshot;
                visibleSpeaker = initialSpeaker ?? "";
                ApplyText();
                IsComplete = true;
                OnPlaybackComplete?.Invoke();
                return;
            }

            IsComplete = false;
            linesAtLastContinue = 0;
            StartCoroutine(RunInstructions(fullMarkupSnapshot, initialSpeaker, instructions));
        }

        IEnumerator RunInstructions(string fullMarkup, string initialSpeaker, IReadOnlyList<PromptInstruction> instructions)
        {
            visibleMarkup = "";
            visibleSpeaker = initialSpeaker ?? "";
            ApplyText();
            var baseMarkup = "";

            for (var index = 0; index < instructions.Count; index++)
            {
                var instruction = instructions[index];
                yield return MaybePause();

                switch (instruction.Kind)
                {
                    case PromptInstructionKind.AppendHtml:
                        baseMarkup += instruction.Html ?? "";
                        visibleMarkup = baseMarkup;
                        ApplyText();
                        yield return MaybePause();
                        break;

                    case PromptInstructionKind.RevealHtml:
                        yield return RevealMarkup(baseMarkup, instruction, revealed =>
                        {
                            baseMarkup += revealed;
                            visibleMarkup = baseMarkup;
                            ApplyText();
                        });
                        break;

                    case PromptInstructionKind.Wait:
                        if (instruction.Milliseconds > 0)
                            yield return new WaitForSeconds(instruction.Milliseconds / 1000f);
                        break;

                    case PromptInstructionKind.WaitForContinue:
                        yield return WaitForContinueGate();
                        break;

                    case PromptInstructionKind.PlaySound:
                        if (soundManager != null)
                            soundManager.PlayDelayed(
                                instruction.AssetId,
                                instruction.DelaySeconds,
                                instruction.StartTime,
                                instruction.EndTime);
                        break;

                    case PromptInstructionKind.UpdateSpeaker:
                        visibleSpeaker = renderSpeakerTemplate != null
                            ? renderSpeakerTemplate(instruction.SpeakerTemplate)
                            : instruction.SpeakerTemplate ?? "";
                        ApplyText();
                        break;

                    case PromptInstructionKind.Reset:
                        baseMarkup = "";
                        visibleMarkup = "";
                        visibleSpeaker = initialSpeaker ?? "";
                        ApplyText();
                        break;

                    case PromptInstructionKind.Clear:
                        baseMarkup = "";
                        visibleMarkup = "";
                        ApplyText();
                        break;
                }
            }

            visibleMarkup = string.IsNullOrEmpty(fullMarkup) ? baseMarkup : fullMarkup;
            ApplyText();
            isRevealing = false;
            awaitingContinue = false;
            dialogueView?.OnRevealEnded();
            dialogueView?.SetShowMoreHint(false);
            IsComplete = true;
            OnPlaybackStateChanged?.Invoke(false);
            OnPlaybackComplete?.Invoke();
        }

        IEnumerator RevealMarkup(string baseMarkup, PromptInstruction instruction, Action<string> onUpdate)
        {
            isRevealing = true;
            dialogueView?.OnRevealStarted();
            OnPlaybackStateChanged?.Invoke(true);
            var html = instruction.Html ?? "";

            if (skipLatchActive || skipRevealRequested)
            {
                skipRevealRequested = false;
                skipLatchActive = false;
                onUpdate(html);
                isRevealing = false;
                dialogueView?.OnRevealEnded();
                OnPlaybackStateChanged?.Invoke(false);
                yield break;
            }

            var maxStep = instruction.RateKind == RevealRateKind.WordsPerSecond
                ? Math.Max(instruction.WordCount, 1)
                : Math.Max(instruction.PlainLength, 1);

            if (instruction.DurationMs > 0)
            {
                var elapsed = 0f;
                var duration = instruction.DurationMs / 1000f;
                while (elapsed < duration)
                {
                    if (ConsumeSkip(html, onUpdate)) yield break;
                    elapsed += Time.deltaTime;
                    var t = Mathf.Clamp01(elapsed / duration);
                    var partial = instruction.OverTimeKind == RevealOverTimeKind.WordsOverTime
                        ? MarkupUtil.PrefixForWordCount(html, Mathf.Max(1, Mathf.RoundToInt(maxStep * t)))
                        : MarkupUtil.PrefixForPlainLength(html, Mathf.Max(1, Mathf.RoundToInt(maxStep * t)));
                    onUpdate(partial);
                    yield return null;
                }
                onUpdate(html);
            }
            else
            {
                var step = 0;
                while (step < maxStep)
                {
                    if (ConsumeSkip(html, onUpdate)) yield break;
                    step++;
                    var partial = instruction.RateKind == RevealRateKind.WordsPerSecond
                        ? MarkupUtil.PrefixForWordCount(html, step)
                        : MarkupUtil.PrefixForPlainLength(html, step);
                    onUpdate(partial);
                    yield return MaybePause();
                    if (ConsumeSkip(html, onUpdate)) yield break;
                    var delay = instruction.RateKind == RevealRateKind.WordsPerSecond
                        ? 1f / (float)instruction.Rate
                        : 1f / (float)instruction.Rate;
                    if (step < maxStep && delay > 0)
                        yield return new WaitForSeconds(delay);
                }
                if (step >= maxStep) onUpdate(html);
            }

            isRevealing = false;
            dialogueView?.OnRevealEnded();
            OnPlaybackStateChanged?.Invoke(false);
        }

        bool ConsumeSkip(string html, Action<string> onUpdate)
        {
            if (!skipRevealRequested) return false;
            skipRevealRequested = false;
            skipLatchActive = true;
            onUpdate(html);
            isRevealing = false;
            dialogueView?.OnRevealEnded();
            OnPlaybackStateChanged?.Invoke(false);
            return true;
        }

        IEnumerator WaitForContinueGate()
        {
            awaitingContinue = true;
            dialogueView?.SetShowContinueHint(true);
            OnPlaybackStateChanged?.Invoke(true);
            while (awaitingContinue) yield return null;
            dialogueView?.SetShowContinueHint(false);
            linesAtLastContinue = dialogueView?.LineCount ?? 0;
            OnPlaybackStateChanged?.Invoke(false);
        }

        IEnumerator MaybePause()
        {
            if (dialogueView == null) yield break;
            yield return WaitForLayoutGate();
            var lines = dialogueView.LineCount;
            if (lines - linesAtLastContinue < continuationLineInterval) yield break;
            dialogueView.SetShowMoreHint(true);
            yield return WaitForContinueGate();
            dialogueView.SetShowMoreHint(false);
        }

        IEnumerator WaitForLayoutGate()
        {
            if (dialogueView == null) yield break;
            var markupLen = visibleMarkup?.Length ?? 0;
            for (var i = 0; i < 120; i++)
            {
                if (dialogueView.PlaybackGate.MeasuredForHtmlLength >= markupLen) yield break;
                yield return null;
            }
        }

        void ApplyText()
        {
            dialogueView?.SetMarkup(visibleMarkup ?? "");
            if (speakerText != null) speakerText.text = visibleSpeaker ?? "";
            onSpeakerChanged?.Invoke(visibleSpeaker ?? "");
        }
    }
}
