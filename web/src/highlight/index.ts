/**
 * CodeMirror 6 editor view + theme registry.
 * Theme list is assembled at build time by the themes Bun plugin
 * (see web/plugins/themes.ts), which scans ./themes/*.ts and
 * exposes the aggregated registry via the `virtual:themes` module.
 */

import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from "@codemirror/language";
import {
  closeBrackets,
  autocompletion,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { searchKeymap } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { allThemes } from "virtual:themes";
import type { HighlightTheme } from "./theme-builder";

// CodeMirror's `basicSetup` bundle, minus `highlightSelectionMatches()`.
// That extension scans the whole document on every selection change to paint
// echoes of the selected word. We don't want the CPU cost or the visual noise.
const editorSetup: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
];

export type { HighlightTheme };

export const highlightThemes: HighlightTheme[] = allThemes;

export function getHighlightTheme(id: string): HighlightTheme {
  return highlightThemes.find((th) => th.id === id) ?? highlightThemes[0];
}

const themeConf = new Compartment();
const readOnlyConf = new Compartment();
const lineWrapConf = new Compartment();

export function createEditorView(
  host: HTMLElement,
  initialValue: string,
  themeId: string,
  onDocChange: () => void,
): EditorView {
  const theme = getHighlightTheme(themeId);
  return new EditorView({
    doc: initialValue,
    extensions: [
      editorSetup,
      markdown({ codeLanguages: languages }),
      themeConf.of(theme.extension),
      readOnlyConf.of(EditorState.readOnly.of(false)),
      lineWrapConf.of([]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onDocChange();
      }),
    ],
    parent: host,
  });
}

export function getValue(view: EditorView): string {
  return view.state.doc.toString();
}

export function setValue(view: EditorView, text: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

export function setReadOnly(view: EditorView, readOnly: boolean): void {
  view.dispatch({
    effects: readOnlyConf.reconfigure(EditorState.readOnly.of(readOnly)),
  });
}

export function setHighlightTheme(view: EditorView, themeId: string): void {
  const theme = getHighlightTheme(themeId);
  view.dispatch({
    effects: themeConf.reconfigure(theme.extension),
  });
}

export function setLineWrap(view: EditorView, wrap: boolean): void {
  view.dispatch({
    effects: lineWrapConf.reconfigure(wrap ? EditorView.lineWrapping : []),
  });
}
