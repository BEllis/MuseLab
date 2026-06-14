using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace MuseLab.UI.Dialogue
{
    public class DialogueMarkupParser
    {
        struct StyleState
        {
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

        enum OpenTagKind
        {
            Bold,
            Italic,
            Color,
            Size,
            Font,
            Style,
            ShakePhrase,
            ShakeChars,
            ShakeChar,
        }

        readonly Stack<OpenTagKind> openTags = new();
        readonly Stack<StyleState> styleStack = new();
        int nextPhraseGroupId = 1;

        static readonly Color DefaultColor = MuseLabUiStyles.TextDark;

        public List<DialogueGlyph> Parse(string markup)
        {
            var glyphs = new List<DialogueGlyph>();
            if (string.IsNullOrEmpty(markup)) return glyphs;

            openTags.Clear();
            styleStack.Clear();
            styleStack.Push(DefaultState());
            nextPhraseGroupId = 1;

            var i = 0;
            var plainIndex = 0;
            while (i < markup.Length)
            {
                if (markup[i] == '<')
                {
                    if (TryReadBr(markup, ref i)) continue;
                    var end = markup.IndexOf('>', i);
                    if (end < 0) break;
                    var tag = markup.Substring(i, end - i + 1);
                    ApplyTag(tag);
                    i = end + 1;
                    continue;
                }
                if (markup[i] == '&')
                {
                    var ch = DecodeEntity(markup, ref i);
                    AppendGlyph(glyphs, ch, ref plainIndex);
                    continue;
                }
                AppendGlyph(glyphs, markup[i], ref plainIndex);
                i++;
            }
            return glyphs;
        }

        void AppendGlyph(List<DialogueGlyph> glyphs, char ch, ref int plainIndex)
        {
            var state = styleStack.Peek();
            glyphs.Add(new DialogueGlyph
            {
                Character = ch,
                PlainIndex = plainIndex,
                FontId = state.FontId,
                SizePx = state.SizePx,
                FontWeight = state.FontWeight,
                Color = state.Color,
                Bold = state.Bold,
                Italic = state.Italic,
                ShakeMode = state.ShakeMode,
                ShakeVariant = state.ShakeVariant,
                PhraseGroupId = state.PhraseGroupId,
            });
            plainIndex++;
        }

        void ApplyTag(string tag)
        {
            if (tag.Length < 3) return;
            var inner = tag.Substring(1, tag.Length - 2).Trim();
            var isClose = inner.StartsWith("/");
            if (isClose)
            {
                var name = inner.Substring(1).Trim();
                CloseTag(name);
                return;
            }

            var space = inner.IndexOf(' ');
            var namePart = space < 0 ? inner : inner.Substring(0, space);
            var attrPart = space < 0 ? "" : inner.Substring(space + 1);
            OpenTag(namePart, attrPart);
        }

        void OpenTag(string name, string attrs)
        {
            var lower = name.ToLowerInvariant();
            var eq = lower.IndexOf('=');
            if (eq > 0)
            {
                attrs = name.Substring(eq + 1);
                lower = lower.Substring(0, eq);
            }
            switch (lower)
            {
                case "b":
                    PushStyle();
                    openTags.Push(OpenTagKind.Bold);
                    var s = styleStack.Peek();
                    s.Bold = true;
                    styleStack.Pop();
                    styleStack.Push(s);
                    break;
                case "i":
                    PushStyle();
                    openTags.Push(OpenTagKind.Italic);
                    s = styleStack.Peek();
                    s.Italic = true;
                    styleStack.Pop();
                    styleStack.Push(s);
                    break;
                case "color":
                    PushStyle();
                    openTags.Push(OpenTagKind.Color);
                    s = styleStack.Peek();
                    s.Color = ParseColor(attrs);
                    styleStack.Pop();
                    styleStack.Push(s);
                    break;
                case "size":
                    PushStyle();
                    openTags.Push(OpenTagKind.Size);
                    s = styleStack.Peek();
                    s.SizePx = ParseIntAttr(attrs, s.SizePx > 0 ? s.SizePx : (int)MuseLabUiStyles.DialogueFontSize);
                    styleStack.Pop();
                    styleStack.Push(s);
                    break;
                case "font":
                    PushStyle();
                    openTags.Push(OpenTagKind.Font);
                    s = styleStack.Peek();
                    s.FontId = ParseQuotedAttr(attrs);
                    styleStack.Pop();
                    styleStack.Push(s);
                    break;
                case "style":
                    PushStyle();
                    openTags.Push(OpenTagKind.Style);
                    s = styleStack.Peek();
                    s.FontWeight = ParseStyleWeight(attrs, s.FontWeight);
                    styleStack.Pop();
                    styleStack.Push(s);
                    break;
                case "shake":
                    PushStyle();
                    if (attrs.Contains("phrase"))
                    {
                        openTags.Push(OpenTagKind.ShakePhrase);
                        s = styleStack.Peek();
                        s.ShakeMode = DialogueShakeMode.Phrase;
                        s.PhraseGroupId = nextPhraseGroupId++;
                        s.ShakeVariant = 0;
                    }
                    else if (attrs.Contains("chars"))
                    {
                        openTags.Push(OpenTagKind.ShakeChars);
                        s = styleStack.Peek();
                        s.ShakeMode = DialogueShakeMode.Chars;
                        s.ShakeVariant = 0;
                    }
                    else if (attrs.Contains("char"))
                    {
                        openTags.Push(OpenTagKind.ShakeChar);
                        s = styleStack.Peek();
                        s.ShakeMode = DialogueShakeMode.Chars;
                        s.ShakeVariant = ParseIntAttr(attrs, 0) % 8;
                    }
                    else
                    {
                        styleStack.Pop();
                    }
                    break;
            }
        }

        void CloseTag(string name)
        {
            var lower = name.ToLowerInvariant();
            OpenTagKind? expected = lower switch
            {
                "b" => OpenTagKind.Bold,
                "i" => OpenTagKind.Italic,
                "color" => OpenTagKind.Color,
                "size" => OpenTagKind.Size,
                "font" => OpenTagKind.Font,
                "style" => OpenTagKind.Style,
                "shake" => null,
                _ => null,
            };

            if (lower == "shake")
            {
                if (openTags.Count == 0) return;
                var kind = openTags.Pop();
                if (styleStack.Count > 1) styleStack.Pop();
                if (kind is OpenTagKind.ShakePhrase or OpenTagKind.ShakeChars or OpenTagKind.ShakeChar)
                    return;
                openTags.Push(kind);
                return;
            }

            if (expected == null) return;
            while (openTags.Count > 0)
            {
                var top = openTags.Pop();
                if (styleStack.Count > 1) styleStack.Pop();
                if (top == expected.Value) return;
            }
        }

        void PushStyle() => styleStack.Push(styleStack.Peek());

        static StyleState DefaultState() => new()
        {
            FontId = null,
            SizePx = 0,
            FontWeight = 0,
            Color = DefaultColor,
            Bold = false,
            Italic = false,
            ShakeMode = DialogueShakeMode.None,
            ShakeVariant = 0,
            PhraseGroupId = 0,
        };

        static bool TryReadBr(string markup, ref int i)
        {
            if (i + 4 > markup.Length) return false;
            if (!markup.Substring(i, 4).Equals("<br>", System.StringComparison.OrdinalIgnoreCase)) return false;
            i += 4;
            return true;
        }

        static char DecodeEntity(string markup, ref int i)
        {
            var end = markup.IndexOf(';', i);
            if (end < 0) return markup[i++];
            var entity = markup.Substring(i, end - i + 1);
            i = end + 1;
            return entity switch
            {
                "&lt;" => '<',
                "&gt;" => '>',
                "&amp;" => '&',
                "&quot;" => '"',
                "&nbsp;" => '\u00a0',
                "&#160;" => '\u00a0',
                _ => entity.Length > 1 ? entity[1] : ' ',
            };
        }

        static Color ParseColor(string attrs)
        {
            var value = attrs.Trim();
            if (value.StartsWith("#") && ColorUtility.TryParseHtmlString(value, out var c))
                return c;
            if (value.StartsWith("="))
            {
                value = value.Substring(1).Trim();
                if (ColorUtility.TryParseHtmlString(value.StartsWith("#") ? value : "#" + value, out c))
                    return c;
            }
            return DefaultColor;
        }

        static int ParseIntAttr(string attrs, int fallback)
        {
            var digits = new StringBuilder();
            foreach (var ch in attrs)
            {
                if (char.IsDigit(ch)) digits.Append(ch);
                else if (digits.Length > 0) break;
            }
            return digits.Length > 0 && int.TryParse(digits.ToString(), out var n) ? n : fallback;
        }

        static int ParseStyleWeight(string attrs, int fallback)
        {
            var value = attrs.Replace("\"", "").Replace("=", "").Trim();
            if (value.StartsWith("F", System.StringComparison.OrdinalIgnoreCase))
                value = value.Substring(1);
            return int.TryParse(value, out var w) ? w : fallback;
        }

        static string ParseQuotedAttr(string attrs)
        {
            var q1 = attrs.IndexOf('"');
            if (q1 < 0) return attrs.Trim().Trim('"', '=');
            var q2 = attrs.IndexOf('"', q1 + 1);
            if (q2 < 0) return attrs.Substring(q1 + 1).Trim('"');
            return attrs.Substring(q1 + 1, q2 - q1 - 1);
        }
    }
}
