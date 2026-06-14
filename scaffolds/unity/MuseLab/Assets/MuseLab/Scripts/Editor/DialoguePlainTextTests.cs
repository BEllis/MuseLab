#if UNITY_INCLUDE_TESTS
using MuseLab.Playback;
using MuseLab.UI.Dialogue;
using NUnit.Framework;

namespace MuseLab.Editor.Tests
{
    public class DialoguePlainTextTests
    {
        [Test]
        public void PrefixForPlainLength_RevealsThroughTags()
        {
            Assert.AreEqual("<b>hi", MarkupUtil.PrefixForPlainLength("<b>hi</b>", 2));
        }

        [Test]
        public void PrefixForWordCount_RevealsThroughWordBoundaries()
        {
            Assert.AreEqual("Hello", MarkupUtil.PrefixForWordCount("Hello world", 1));
            Assert.AreEqual("Hello world", MarkupUtil.PrefixForWordCount("Hello world", 2));
        }

        [Test]
        public void PrefixForWordCount_RevealsThroughNbspSeparatedWords()
        {
            Assert.AreEqual("Something", MarkupUtil.PrefixForWordCount("Something&nbsp;really&nbsp;long", 1));
            Assert.AreEqual("Something&nbsp;really", MarkupUtil.PrefixForWordCount("Something&nbsp;really&nbsp;long", 2));
            Assert.AreEqual("Something&nbsp;really&nbsp;long", MarkupUtil.PrefixForWordCount("Something&nbsp;really&nbsp;long", 3));
        }

        [Test]
        public void PrefixForPlainLength_RevealsThroughShakeTags()
        {
            var markup = "<shake char=\"3\">C</shake><shake char=\"1\">r</shake>";
            Assert.AreEqual("<shake char=\"3\">C", MarkupUtil.PrefixForPlainLength(markup, 1));
        }

        [Test]
        public void MarkupParser_ToleratesUnclosedBoldTag()
        {
            var parser = new DialogueMarkupParser();
            var glyphs = parser.Parse("<b>hi");
            Assert.AreEqual(2, glyphs.Count);
            Assert.IsTrue(glyphs[0].Bold);
            Assert.IsTrue(glyphs[1].Bold);
        }

        [Test]
        public void MarkupParser_AssignsShakeVariantPerChar()
        {
            var parser = new DialogueMarkupParser();
            var glyphs = parser.Parse("<shake char=\"5\">!</shake>");
            Assert.AreEqual(1, glyphs.Count);
            Assert.AreEqual(DialogueShakeMode.Chars, glyphs[0].ShakeMode);
            Assert.AreEqual(5, glyphs[0].ShakeVariant);
        }

        [Test]
        public void MarkupParser_AssignsPhraseShakeGroup()
        {
            var parser = new DialogueMarkupParser();
            var glyphs = parser.Parse("<shake phrase=\"1\">ab</shake>");
            Assert.AreEqual(2, glyphs.Count);
            Assert.AreEqual(DialogueShakeMode.Phrase, glyphs[0].ShakeMode);
            Assert.AreEqual(glyphs[0].PhraseGroupId, glyphs[1].PhraseGroupId);
        }
    }
}
#endif
