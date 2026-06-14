import { parser } from "@/core/cito/museLabRazor.parser";
import {
  HighlightStyle,
  LRLanguage,
  LanguageSupport,
  syntaxHighlighting,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

const razorParser = parser.configure({
  props: [
    styleTags({
      Text: t.content,
      EscapedAt: t.escape,
      OutputExpr: t.special(t.variableName),
      OutputExprParen: t.special(t.variableName),
      CodeBlock: t.processingInstruction,
      IfBlock: t.controlKeyword,
    }),
  ],
});

export const museLabRazorLanguage = LRLanguage.define({
  name: "muselab-razor",
  parser: razorParser,
  languageData: {
    closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
  },
});

const razorHighlightStyle = HighlightStyle.define([
  { tag: t.content, class: "cm-template-literal" },
  { tag: t.special(t.variableName), class: "cm-template-output" },
  { tag: t.processingInstruction, class: "cm-template-statement" },
  { tag: t.controlKeyword, class: "cm-template-control" },
  { tag: t.escape, class: "cm-template-delimiter" },
  { tag: t.string, class: "cm-template-string" },
]);

export function museLabRazorLanguageSupport(): LanguageSupport {
  return new LanguageSupport(museLabRazorLanguage, [
    syntaxHighlighting(razorHighlightStyle),
  ]);
}
