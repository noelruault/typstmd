# Plan: CodeMirror 6 Syntax Highlighting with Zed One Theme

## Context

Replace the plain `<textarea>` with CodeMirror 6 for syntax highlighting. Zed's One Dark / One Light palette for colors. No abstraction layers, no runtime toggle, no adapter pattern. One file does the CodeMirror setup, `main.ts` uses it. Revert with git if we don't like it.

## Color Palette (from Zed One theme)

### One Dark (dark mode)

| Token | Hex |
|---|---|
| Background | `#282c33` |
| Foreground | `#acb2be` |
| Comment | `#5d636f` |
| Keyword | `#b477cf` |
| String | `#a1c181` |
| Number | `#bf956a` |
| Function | `#73ade9` |
| Type | `#6eb4bf` |
| Property/Title | `#d07277` |
| Emphasis | `#74ade8` |
| Strong | `#bf956a` (bold) |
| Link text | `#73ade9` (italic) |
| Link URL | `#6eb4bf` |
| Operator | `#6eb4bf` |
| Punctuation | `#b2b9c6` |
| Line numbers | `#4e5a5f` |
| Active line | `#2f343ebf` |
| Selection | `#74ade83d` |
| Cursor | `#74ade8` |

### One Light (light mode)

| Token | Hex |
|---|---|
| Background | `#fafafa` |
| Foreground | `#242529` |
| Comment | `#7c7e86` |
| Keyword | `#a449ab` |
| String | `#649f57` |
| Number | `#ad6e25` |
| Function | `#5b79e3` |
| Type | `#3882b7` |
| Property/Title | `#d3604f` |
| Emphasis | `#5c78e2` |
| Strong | `#ad6e25` (bold) |
| Link text | `#5b79e3` (italic) |
| Link URL | `#3882b7` |
| Operator | `#3882b7` |
| Punctuation | `#4d4f52` |
| Line numbers | `#b4b4bb` |
| Active line | `#ebebecbf` |
| Selection | `#5c78e23d` |
| Cursor | `#5c78e2` |

## Dependencies

```
bun add codemirror @codemirror/lang-markdown @codemirror/language-data
```

All get bundled into `main.js` by `bun build`. No code-splitting needed. Same as every other npm dep.

## Files

### New

1. `web/src/highlight.ts`: CodeMirror setup, themes, exports helper functions

### Modified

2. `web/src/main.ts`: use CodeMirror instead of textarea
3. `web/index.html`: replace `<textarea>` with `<div id="editor-host">`, CSS for CodeMirror fill

## Step 1: `web/src/highlight.ts`

Single file. Creates and manages the CodeMirror EditorView.

```ts
import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorState, Compartment } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Theme definitions (One Dark + One Light) inline here (~40 lines each)
// ...

const themeConf = new Compartment();
const readOnlyConf = new Compartment();

export function createEditorView(host: HTMLElement, initialValue: string, dark: boolean): EditorView {
  return new EditorView({
    doc: initialValue,
    extensions: [
      basicSetup,
      markdown({ codeLanguages: languages }),
      themeConf.of(dark ? oneDark : oneLight),
      readOnlyConf.of(EditorState.readOnly.of(false)),
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": { overflow: "auto" },
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
  view.dispatch({ effects: readOnlyConf.reconfigure(EditorState.readOnly.of(readOnly)) });
}

export function setDark(view: EditorView, dark: boolean): void {
  view.dispatch({ effects: themeConf.reconfigure(dark ? oneDark : oneLight) });
}
```

No class. No interface. Just functions that take the EditorView.

## Step 2: `web/index.html`

Replace:
```html
<textarea id="editor" spellcheck="false">Loading...</textarea>
```

With:
```html
<div id="editor-host"></div>
```

CSS additions for CodeMirror to fill the container:
```css
#editor-host {
  flex: 1;
  border-right: 1px solid var(--border-main);
  overflow: hidden;
}
#editor-host .cm-editor {
  height: 100%;
}
#editor-host .cm-scroller {
  overflow: auto;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 13px;
}
```

Remove old `#editor` textarea styles. Keep CSS custom properties for toolbar/status (unchanged).

Mobile rules update `#editor` references to `#editor-host`.

## Step 3: `web/src/main.ts`

Replace textarea usage with highlight.ts functions:

| Old | New |
|---|---|
| `editor.value` | `getValue(view)` |
| `editor.value = x` | `setValue(view, x)` |
| `editor.readOnly = true` | `setReadOnly(view, true)` |
| `editor.addEventListener("input", fn)` | `EditorView.updateListener.of(update => { if (update.docChanged) fn() })` |

The update listener is added as an extension during `createEditorView()`. Pass the compile/save callbacks.

View mode transitions stay in `main.ts`:
- `enterSourceMode()`: `setValue(view, lastTypstSource)`, `setReadOnly(view, true)`
- `exitSourceMode()`: `setValue(view, currentMarkdown)`, `setReadOnly(view, false)`
- `enterTemplateMode()`: `setValue(view, resolveTemplate(...))`, `setReadOnly(view, false)`
- `exitTemplateMode()`: `setValue(view, currentMarkdown)`, `setReadOnly(view, false)`

No `.source-view` / `.template-view` CSS classes needed. CodeMirror handles its own styling via the theme compartment. If we want visual distinction between source and template mode, add it to the host div: `editorHost.classList.add("source-mode")`.

Dark mode: `applyDarkMode()` calls `setDark(view, dark)` alongside the existing `body.dark` toggle.

Init:
```ts
const editorHost = document.getElementById("editor-host") as HTMLDivElement;
const view = createEditorView(editorHost, currentMarkdown, isDark);
```

## Typst language mode (deferred)

Markdown mode only for now. Template/source view shows Typst as plain text with the One theme chrome. Adding Typst highlighting later means adding a language to `highlight.ts` and a compartment swap. No structural changes.

## Verification

1. Markdown editing: headings red, bold orange, code green, links blue
2. Dark mode toggle: theme swaps instantly
3. Source view: shows Typst output, read-only
4. Template view: shows Typst template, editable
5. Fenced code blocks: language-specific highlighting (js, python, etc.)
6. Mobile: CodeMirror 6 usable on touch devices
7. Build: `bun build` produces single `main.js`, worker serves it fine
8. Measure: check actual bundle size increase
