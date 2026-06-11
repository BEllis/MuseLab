using System;
using System.Collections;
using System.Collections.Generic;
using MuseLab.Audio;
using TMPro;
using UnityEngine;

namespace MuseLab.Playback
{
    public class PromptInstructionPlayer : MonoBehaviour
    {
        public event Action<bool> OnPlaybackStateChanged;
        public event Action OnPlaybackComplete;

        SoundManager soundManager;
        TMP_Text dialogueText;
        TMP_Text speakerText;
        Func<string, string> renderSpeakerTemplate;
        Action<string> onSpeakerChanged;

        string visibleMarkup = "";
        string visibleSpeaker = "";
        bool awaitingContinue;
        bool isRevealing;
        bool skipRevealRequested;
        int linesAtLastContinue;
        int continuationLineInterval = PromptInstructionRules.DefaultContinuationVisualLineInterval;

        public bool IsComplete { get; private set; } = true;
        public bool AwaitingContinue => awaitingContinue;
        public bool IsRevealing => isRevealing;
        public string VisibleMarkup => visibleMarkup;
        public string VisibleSpeaker => visibleSpeaker;

        public void Configure(
            SoundManager sound,
            TMP_Text dialogue,
            TMP_Text speaker,
            Func<string, string> speakerRenderer,
            Action<string> speakerChanged = null)
        {
            soundManager = sound;
            dialogueText = dialogue;
            speakerText = speaker;
            renderSpeakerTemplate = speakerRenderer;
            onSpeakerChanged = speakerChanged;
        }

        public void StopPlayback()
        {
            StopAllCoroutines();
            isRevealing = false;
            awaitingContinue = false;
        }

        public void RequestContinue()
        {
            if (awaitingContinue) awaitingContinue = false;
        }

        public void RequestSkipReveal()
        {
            skipRevealRequested = true;
        }

        public void Play(string fullMarkup, string initialSpeaker, IReadOnlyList<PromptInstruction> instructions)
        {
            StopPlayback();
            if (!PromptInstructionRules.NeedExecutor(instructions))
            {
                visibleMarkup = fullMarkup ?? "";
                visibleSpeaker = initialSpeaker ?? "";
                ApplyText();
                IsComplete = true;
                OnPlaybackComplete?.Invoke();
                return;
            }

            IsComplete = false;
            linesAtLastContinue = 0;
            StartCoroutine(RunInstructions(fullMarkup, initialSpeaker, instructions));
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
            IsComplete = true;
            OnPlaybackStateChanged?.Invoke(false);
            OnPlaybackComplete?.Invoke();
        }

        IEnumerator RevealMarkup(string baseMarkup, PromptInstruction instruction, Action<string> onUpdate)
        {
            isRevealing = true;
            OnPlaybackStateChanged?.Invoke(true);
            var html = instruction.Html ?? "";
            var maxStep = instruction.RateKind == RevealRateKind.WordsPerSecond
                ? Math.Max(instruction.WordCount, 1)
                : Math.Max(instruction.PlainLength, 1);

            if (instruction.DurationMs > 0)
            {
                var elapsed = 0f;
                var duration = instruction.DurationMs / 1000f;
                while (elapsed < duration)
                {
                    if (skipRevealRequested) { skipRevealRequested = false; break; }
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
                    if (skipRevealRequested)
                    {
                        skipRevealRequested = false;
                        onUpdate(html);
                        break;
                    }
                    step++;
                    var partial = instruction.RateKind == RevealRateKind.WordsPerSecond
                        ? MarkupUtil.PrefixForWordCount(html, step)
                        : MarkupUtil.PrefixForPlainLength(html, step);
                    onUpdate(partial);
                    yield return MaybePause();
                    if (skipRevealRequested)
                    {
                        skipRevealRequested = false;
                        onUpdate(html);
                        break;
                    }
                    var delay = instruction.RateKind == RevealRateKind.WordsPerSecond
                        ? 1f / (float)instruction.Rate
                        : 1f / (float)instruction.Rate;
                    if (step < maxStep && delay > 0)
                        yield return new WaitForSeconds(delay);
                }
                if (step >= maxStep) onUpdate(html);
            }

            isRevealing = false;
            OnPlaybackStateChanged?.Invoke(false);
        }

        IEnumerator WaitForContinueGate()
        {
            awaitingContinue = true;
            OnPlaybackStateChanged?.Invoke(true);
            while (awaitingContinue) yield return null;
            linesAtLastContinue = MeasureVisualLines(visibleMarkup);
            OnPlaybackStateChanged?.Invoke(false);
        }

        IEnumerator MaybePause()
        {
            if (dialogueText == null) yield break;
            var lines = MeasureVisualLines(visibleMarkup);
            if (lines - linesAtLastContinue < continuationLineInterval) yield break;
            yield return WaitForContinueGate();
        }

        int MeasureVisualLines(string markup)
        {
            if (dialogueText == null) return 0;
            dialogueText.text = markup ?? "";
            dialogueText.ForceMeshUpdate();
            return dialogueText.textInfo.lineCount;
        }

        void ApplyText()
        {
            if (dialogueText != null) dialogueText.text = visibleMarkup ?? "";
            if (speakerText != null) speakerText.text = visibleSpeaker ?? "";
            onSpeakerChanged?.Invoke(visibleSpeaker ?? "");
        }
    }
}
