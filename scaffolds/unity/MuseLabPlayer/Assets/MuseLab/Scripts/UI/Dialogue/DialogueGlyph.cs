using UnityEngine;

namespace MuseLab.UI.Dialogue
{
    public enum DialogueShakeMode
    {
        None,
        Phrase,
        Chars,
    }

    public struct DialogueGlyph
    {
        public char Character;
        public int PlainIndex;
        public string FontId;
        public int SizePx;
        public int FontWeight;
        public Color Color;
        public bool Bold;
        public bool Italic;
        public DialogueShakeMode ShakeMode;
        public int ShakeVariant;
        public int PhraseGroupId;
    }
}
