/**
 * Shared theme builder for CodeMirror highlight themes.
 * Each theme file uses buildTheme() to define editor chrome + syntax colors.
 */

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

export interface ThemeColors {
  bg: string;
  fg: string;
  gutterBg: string;
  gutterFg: string;
  activeGutterFg: string;
  activeLine: string;
  cursor: string;
  selection: string;
  search: string;
  searchActive?: string;
  dark?: boolean;
}

export interface SyntaxColors {
  heading: string;
  headingWeight?: string;
  emphasis: string;
  strong: string;
  keyword: string;
  string: string;
  number: string;
  function: string;
  type: string;
  property: string;
  comment: string;
  url: string;
  link: string;
  operator: string;
  punctuation: string;
  meta: string;
  quote: string;
  monospace: string;
}

export interface HighlightTheme {
  id: string;
  name: string;
  dark: boolean;
  extension: Extension;
}

export function buildTheme(colors: ThemeColors, syntax: SyntaxColors): Extension {
  const editorTheme = EditorView.theme(
    {
      "&": { backgroundColor: colors.bg, color: colors.fg },
      ".cm-gutters": {
        backgroundColor: colors.gutterBg,
        color: colors.gutterFg,
        border: "none",
      },
      ".cm-activeLineGutter": { color: colors.activeGutterFg },
      ".cm-activeLine": { backgroundColor: colors.activeLine },
      "&.cm-focused .cm-cursor": { borderLeftColor: colors.cursor },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: colors.selection,
      },
      ".cm-searchMatch": { backgroundColor: colors.search },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: colors.searchActive ?? colors.search,
      },
    },
    { dark: colors.dark ?? false },
  );

  const highlight = HighlightStyle.define([
    { tag: t.heading, color: syntax.heading, fontWeight: syntax.headingWeight ?? undefined },
    { tag: t.emphasis, color: syntax.emphasis, fontStyle: "italic" },
    { tag: t.strong, color: syntax.strong, fontWeight: "bold" },
    { tag: t.keyword, color: syntax.keyword },
    { tag: t.string, color: syntax.string },
    { tag: t.number, color: syntax.number },
    { tag: t.function(t.variableName), color: syntax.function },
    { tag: t.typeName, color: syntax.type },
    { tag: t.propertyName, color: syntax.property },
    { tag: t.comment, color: syntax.comment },
    { tag: t.url, color: syntax.url },
    { tag: t.link, color: syntax.link, fontStyle: "italic" },
    { tag: t.operator, color: syntax.operator },
    { tag: t.punctuation, color: syntax.punctuation },
    { tag: t.meta, color: syntax.meta },
    { tag: t.processingInstruction, color: syntax.meta },
    { tag: t.quote, color: syntax.quote, fontStyle: "italic" },
    { tag: t.monospace, color: syntax.monospace },
  ]);

  return [editorTheme, syntaxHighlighting(highlight)];
}
