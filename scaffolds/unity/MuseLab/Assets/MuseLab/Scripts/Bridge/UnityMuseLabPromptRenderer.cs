using System.Collections.Generic;
using MuseLab.Playback;

namespace MuseLab.Bridge
{
    public class UnityMuseLabPromptRenderer : IMuseLabPromptRenderer
    {
        readonly PromptInstructionRecorder recorder = new();
        readonly RichTextBuilder builder;

        public UnityMuseLabPromptRenderer(bool disableShake = false)
        {
            builder = new RichTextBuilder(disableShake);
        }

        public IReadOnlyList<PromptInstruction> GetInstructions() => recorder.Instructions;

        public PromptInstructionRecorder GetRecorder() => recorder;

        public void BeginRenderPass()
        {
            recorder.Clear();
            builder.Clear();
        }

        public override void AddLiteral(string text)
        {
            var beforeLen = builder.Render().Length;
            builder.AddLiteral(text);
            var added = builder.Render().Substring(beforeLen);
            recorder.AppendRevealText(added, text ?? "");
        }

        public override void AppendResult(string value)
        {
            if (string.IsNullOrEmpty(value)) return;
            var beforeLen = builder.Render().Length;
            builder.AppendResult(value);
            var added = builder.Render().Substring(beforeLen);
            recorder.AppendRevealText(added, value);
        }

        public override void ApplyFormat(string marker)
        {
            var beforeLen = builder.Render().Length;
            builder.ApplyFormat(marker);
            var added = builder.Render().Substring(beforeLen);
            var plain = "";
            if (FormatMarkerCodec.TryDecode(marker, out var kind, out var data) &&
                kind is FormatMarkerKind.ShakeCharsText or FormatMarkerKind.ShakePhraseText)
                plain = data.text ?? "";
            recorder.AppendRevealText(added, plain);
        }

        public override void WaitInMs(int milliseconds) => recorder.Wait(milliseconds);

        public override void RevealCharsBegin(double charsPerSecond) => recorder.RevealCharsBegin(charsPerSecond);

        public override void RevealWordsBegin(double wordsPerSecond) => recorder.RevealWordsBegin(wordsPerSecond);

        public override void RevealCharsOverTimeBegin(int durationMs) => recorder.RevealCharsOverTimeBegin(durationMs);

        public override void RevealWordsOverTimeBegin(int durationMs) => recorder.RevealWordsOverTimeBegin(durationMs);

        public override void RevealEnd() => recorder.RevealEnd();

        public override void WaitForContinue() => recorder.WaitForContinue();

        public override void UpdateSpeaker(string template) => recorder.UpdateSpeaker(template);

        public override void Reset()
        {
            builder.Clear();
            recorder.Reset();
        }

        public override void Clear()
        {
            builder.Clear();
            recorder.ClearInstruction();
        }

        public override string Render() => builder.Render();
    }
}
