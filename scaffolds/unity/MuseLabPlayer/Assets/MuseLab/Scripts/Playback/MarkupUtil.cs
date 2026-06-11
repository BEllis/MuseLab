namespace MuseLab.Playback
{
    public static class MarkupUtil
    {
        public static string StripTags(string markup) => DialoguePlainText.FromMarkup(markup);

        public static string PrefixForPlainLength(string markup, int targetPlainLength)
            => DialoguePlainText.PrefixForPlainLength(markup, targetPlainLength);

        public static string PrefixForWordCount(string markup, int targetWordCount)
            => DialoguePlainText.PrefixForWordCount(markup, targetWordCount);
    }
}
