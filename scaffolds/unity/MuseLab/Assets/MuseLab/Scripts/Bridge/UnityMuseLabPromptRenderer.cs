using System.Collections.Generic;
using System.Text;
using MuseLab.Playback;
using MuseLab.Scene;

namespace MuseLab.Bridge
{
    public class UnityMuseLabPromptRenderer : IMuseLabPromptRenderer
    {
        readonly PromptInstructionRecorder recorder = new();
        readonly RichTextBuilder builder;
        readonly RichTextBuilder speakerBuilder;
        bool capturingSpeaker;
        string speakerHtml = "";

        public UnityMuseLabPromptRenderer(bool disableShake = false)
        {
            builder = new RichTextBuilder(disableShake);
            speakerBuilder = new RichTextBuilder(disableShake);
        }

        public IReadOnlyList<PromptInstruction> GetInstructions() => recorder.Instructions;

        public PromptInstructionRecorder GetRecorder() => recorder;

        public void BeginRenderPass()
        {
            recorder.Clear();
            builder.Clear();
            speakerBuilder.Clear();
            capturingSpeaker = false;
            speakerHtml = "";
        }

        RichTextBuilder ActiveBuilder => capturingSpeaker ? speakerBuilder : builder;

        public override void AddLiteral(string text)
        {
            var target = ActiveBuilder;
            var beforeLen = target.Render().Length;
            target.AddLiteral(text);
            var added = target.Render().Substring(beforeLen);
            if (!capturingSpeaker)
                recorder.AppendRevealText(added, text ?? "");
        }

        public override void AppendResult(string value)
        {
            if (string.IsNullOrEmpty(value)) return;
            var target = ActiveBuilder;
            var beforeLen = target.Render().Length;
            target.AppendResult(value);
            var added = target.Render().Substring(beforeLen);
            if (!capturingSpeaker)
                recorder.AppendRevealText(added, value);
        }

        public override void ApplyFormat(string marker)
        {
            var target = ActiveBuilder;
            var beforeLen = target.Render().Length;
            target.ApplyFormat(marker);
            var added = target.Render().Substring(beforeLen);
            var plain = "";
            if (FormatMarkerCodec.TryDecode(marker, out var kind, out var data) &&
                kind is FormatMarkerKind.ShakeCharsText or FormatMarkerKind.ShakePhraseText)
                plain = data.text ?? "";
            if (!capturingSpeaker)
                recorder.AppendRevealText(added, plain);
        }

        public override void WaitInMs(int milliseconds) => recorder.Wait(milliseconds);

        public override void RevealCharsBegin(double charsPerSecond) => recorder.RevealCharsBegin(charsPerSecond);

        public override void RevealWordsBegin(double wordsPerSecond) => recorder.RevealWordsBegin(wordsPerSecond);

        public override void RevealCharsOverTimeBegin(int durationMs) => recorder.RevealCharsOverTimeBegin(durationMs);

        public override void RevealWordsOverTimeBegin(int durationMs) => recorder.RevealWordsOverTimeBegin(durationMs);

        public override void RevealEnd() => recorder.RevealEnd();

        public override void WaitForContinue() => recorder.WaitForContinue();

        public override void SpeakerBegin()
        {
            capturingSpeaker = true;
            speakerBuilder.Clear();
        }

        public override void SpeakerEnd()
        {
            speakerHtml = speakerBuilder.Render();
            capturingSpeaker = false;
            recorder.UpdateSpeaker(speakerHtml);
        }

        public override void ShowDialogue(string channel) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.DialogueShow,
                Channel = channel,
            });

        public override void HideDialogue(string channel) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.DialogueHide,
                Channel = channel,
            });

        public override void Reset()
        {
            builder.Clear();
            speakerBuilder.Clear();
            speakerHtml = "";
            capturingSpeaker = false;
            recorder.Reset();
        }

        public override void Clear()
        {
            builder.Clear();
            recorder.ClearInstruction();
        }

        public override string Render() => builder.Render();

        public override string GetSpeakerHtml() => speakerHtml;
    }
}
