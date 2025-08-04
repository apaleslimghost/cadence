import {buildParser} from '@lezer/generator'

import {LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"

const parser = buildParser(`
  @top Program { expression }

  @skip { space }

  expression {
    Identifier |
    String |
    Symbol |
    Application { "(" expression* ")" }
  }

  @tokens {
    Identifier { $[a-zA-Z_\\-0-9]+ }

    String { '"' (!["\\\\] | "\\\\" _)* '"' }

    Symbol { "'" $[a-zA-Z_\\-0-9]+ }

    space { $[ \\t\\n\\r]+ }

    "(" ")"
  }

  @detectDelim
`)

export const CadenceLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Application: delimitedIndent({closing: ")", align: false})
      }),
      foldNodeProp.add({
        Application: foldInside
      }),
      styleTags({
        Identifier: t.variableName,
        Boolean: t.bool,
        String: t.string,
        Symbol: t.literal,
        "( )": t.paren
      })
    ]
  }),
  languageData: {

  }
})

export function Cadence() {
  return new LanguageSupport(CadenceLanguage)
}
