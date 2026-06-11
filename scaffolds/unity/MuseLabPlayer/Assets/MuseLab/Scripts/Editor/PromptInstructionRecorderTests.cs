#if UNITY_INCLUDE_TESTS
using System.Linq;
using MuseLab.Playback;
using NUnit.Framework;

namespace MuseLab.Editor.Tests
{
    public class PromptInstructionRecorderTests
    {
        [Test]
        public void OverTimeFlush_PreservesInterleavedOrder()
        {
            var recorder = new PromptInstructionRecorder();
            recorder.RevealWordsOverTimeBegin(1000);
            recorder.AppendRevealText("Hello", "Hello");
            recorder.Wait(100);
            recorder.UpdateSpeaker("{{name}}");
            recorder.PlaySound("sfx", 0, -1, -1);
            recorder.AppendRevealText(" world", " world");
            recorder.RevealEnd();

            var kinds = recorder.Instructions.Select(i => i.Kind).ToList();
            Assert.Contains(PromptInstructionKind.RevealHtml, kinds);
            Assert.Contains(PromptInstructionKind.Wait, kinds);
            Assert.Contains(PromptInstructionKind.UpdateSpeaker, kinds);
            Assert.Contains(PromptInstructionKind.PlaySound, kinds);

            var waitIndex = kinds.IndexOf(PromptInstructionKind.Wait);
            var speakerIndex = kinds.IndexOf(PromptInstructionKind.UpdateSpeaker);
            var soundIndex = kinds.IndexOf(PromptInstructionKind.PlaySound);
            Assert.Less(waitIndex, speakerIndex);
            Assert.Less(speakerIndex, soundIndex);
        }
    }
}
#endif
