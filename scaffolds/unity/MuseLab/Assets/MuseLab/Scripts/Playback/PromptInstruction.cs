using System;
using System.Collections.Generic;

namespace MuseLab.Playback
{
    public enum PromptInstructionKind
    {
        AppendHtml,
        RevealHtml,
        Wait,
        WaitForContinue,
        PlaySound,
        UpdateSpeaker,
        Reset,
        Clear,
    }

    public enum RevealRateKind
    {
        CharsPerSecond,
        WordsPerSecond,
    }

    public enum RevealOverTimeKind
    {
        CharsOverTime,
        WordsOverTime,
    }

    [Serializable]
    public class PromptInstruction
    {
        public PromptInstructionKind Kind;
        public string Html;
        public int PlainLength;
        public int WordCount;
        public RevealRateKind RateKind;
        public RevealOverTimeKind OverTimeKind;
        public double Rate;
        public int DurationMs;
        public int Milliseconds;
        public string AssetId;
        public double DelaySeconds;
        public double StartTime = -1;
        public double EndTime = -1;
        public string SpeakerTemplate;
    }

    public static class PromptInstructionRules
    {
        public const double DefaultCharsPerSecond = 40;
        public const double DefaultWordsPerSecond = 12;
        public const int DefaultContinuationVisualLineInterval = 3;

        public static bool NeedExecutor(IReadOnlyList<PromptInstruction> instructions)
        {
            foreach (var instruction in instructions)
            {
                switch (instruction.Kind)
                {
                    case PromptInstructionKind.AppendHtml:
                    case PromptInstructionKind.Wait:
                    case PromptInstructionKind.WaitForContinue:
                    case PromptInstructionKind.RevealHtml:
                    case PromptInstructionKind.PlaySound:
                    case PromptInstructionKind.UpdateSpeaker:
                    case PromptInstructionKind.Reset:
                    case PromptInstructionKind.Clear:
                        return true;
                }
            }
            return false;
        }

        public static int CountWords(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            var parts = text.Trim().Split((char[])null, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length;
        }

        public static double NormalizeRate(double rate, double defaultRate)
        {
            if (rate < 0 || rate == 0) return defaultRate;
            return rate;
        }
    }
}
