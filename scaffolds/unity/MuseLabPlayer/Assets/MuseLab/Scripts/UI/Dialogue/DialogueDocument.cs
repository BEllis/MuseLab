using System.Collections.Generic;

namespace MuseLab.UI.Dialogue
{
    public class DialogueDocument
    {
        public string SourceMarkup { get; private set; } = "";
        public IReadOnlyList<DialogueGlyph> Glyphs => glyphs;

        readonly List<DialogueGlyph> glyphs = new();

        public void BuildFromMarkup(string markup, DialogueMarkupParser parser)
        {
            SourceMarkup = markup ?? "";
            glyphs.Clear();
            glyphs.AddRange(parser.Parse(SourceMarkup));
        }

        public int PlainLength => glyphs.Count;
    }
}
