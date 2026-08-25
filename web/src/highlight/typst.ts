// Emits only the lezer tags ./themes/*.ts already style, so Typst shares the Markdown palette with no per-theme work.
// A tokenizer, not a full Typst parser: no markup/code mode distinction, so a stray `*` or `=` inside code can miscolour.

import { StreamLanguage, LanguageSupport } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

interface TypstState {
  block: boolean;
  raw: boolean;
}

const CODE_KEYWORD =
  /^(let|set|show|import|include|context|if|else|for|while|return|in|as|and|or|not)\b/;
const ATOM = /^(none|auto|true|false)\b/;
// A Typst length/ratio literal keeps its unit glued to the number.
const NUMBER = /^(\d+(\.\d+)?|\.\d+)(pt|mm|cm|in|em|fr|deg|rad|%)?/;

const parser = StreamLanguage.define<TypstState>({
  name: "typst",
  startState: () => ({ block: false, raw: false }),
  token(stream, state) {
    if (state.raw) {
      if (stream.sol() && stream.match(/^```/)) state.raw = false;
      else stream.skipToEnd();
      return "monospace";
    }
    if (state.block) {
      if (stream.skipTo("*/")) {
        stream.match(/\*\//);
        state.block = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // A heading is line-initial `=`+ then whitespace; anywhere else `=` is an operator.
    if (stream.sol() && stream.match(/^=+\s/)) return "heading";

    if (stream.eatSpace()) return null;

    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.block = true;
      return "comment";
    }

    if (stream.match(/^```[A-Za-z0-9_-]*/)) {
      state.raw = true;
      return "monospace";
    }
    if (stream.peek() === "`") {
      stream.next();
      while (!stream.eol()) if (stream.next() === "`") break;
      return "monospace";
    }

    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol()) {
        const c = stream.next();
        if (c === "\\") {
          stream.next();
          continue;
        }
        if (c === '"') break;
      }
      return "string";
    }

    if (stream.match("#")) {
      if (stream.match(CODE_KEYWORD) || stream.match(ATOM)) return "keyword";
      if (stream.match(/^[A-Za-z_][\w-]*(\.[A-Za-z_][\w-]*)*/)) return "fn";
      return "meta";
    }

    if (stream.match(/^<[A-Za-z_][\w.-]*>/)) return "meta";
    if (stream.match(/^@[A-Za-z_][\w.-]*/)) return "link";

    if (stream.match(NUMBER)) return "number";
    if (stream.match(CODE_KEYWORD) || stream.match(ATOM)) return "keyword";
    if (stream.match(/^[A-Za-z_][\w-]*(?=\()/)) return "fn";
    if (stream.match(/^[A-Za-z_][\w-]*/)) return null;
    if (stream.match(/^(=>|==|!=|<=|>=|\.\.|[+\-*/=<>])/)) return "operator";

    stream.next();
    return null;
  },
  tokenTable: {
    heading: t.heading,
    keyword: t.keyword,
    string: t.string,
    number: t.number,
    comment: t.comment,
    fn: t.function(t.variableName),
    monospace: t.monospace,
    meta: t.meta,
    link: t.link,
    operator: t.operator,
  },
});

export function typst(): LanguageSupport {
  return new LanguageSupport(parser);
}
