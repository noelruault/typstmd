# Syntax Highlighting Benchmark: Ace vs CodeMirror 6

## Context

The typstmd web editor uses a plain `<textarea>` which cannot color text. To add syntax highlighting (headings, code, bold in different colors), we need a code editor component. Two candidates: Ace and CodeMirror 6.

## Comparison

| Criterion | Ace | CodeMirror 6 |
|---|---|---|
| Core bundle (min+gz) | ~100-110 KB | ~55-70 KB |
| Markdown mode | Built-in | Built-in (`@codemirror/lang-markdown`) |
| Typst mode | No (custom work needed) | No official (community `codemirror-lang-typst` exists) |
| Tree-shaking | Poor (monolithic) | Excellent (ES modules, pay for what you import) |
| Mobile support | Poor (desktop-first design) | Good (designed for mobile from the start) |
| API style | Imperative/OO (`ace.edit()`) | Declarative/functional (extensions, state transactions) |
| Themes | ~30+ built-in | CSS-in-JS API, `theme-one-dark` built-in, fully customizable |
| Dark mode integration | Pick a theme string | Compose with our existing CSS custom properties |
| Bracket matching | Built-in | Extension (`bracketMatching()`) |
| Search/replace | Built-in | Extension (`@codemirror/search`) |
| Code folding | Built-in | Extension (`foldGutter()`) |
| Collaborative editing | No | Built-in (`@codemirror/collab`) |
| Accessibility | Basic | Strong (ARIA, screen reader support by design) |
| Maintenance | Active, slower cadence (AWS/Cloud9) | Active, regular releases (Marijn Haverbeke) |
| License | BSD-3-Clause | MIT |

## Key observations

**Size**: CodeMirror 6 is roughly half the weight of Ace for equivalent functionality. With tree-shaking, unused features cost nothing. This matters because typstmd already loads a ~15MB WASM blob for the Typst compiler.

**Typst highlighting**: Neither has official Typst support. CodeMirror 6 has a community package (`codemirror-lang-typst`) and a cleaner path to custom grammars via Lezer. Ace requires writing a custom tokenizer (~100-300 lines). Both require similar effort for a production-quality Typst mode.

**Mobile**: Ace was built for desktop IDEs. CodeMirror 6 was rewritten from scratch with mobile as a design goal. typstmd already has a responsive layout and mobile users. Ace would regress the mobile experience.

**Dark mode**: We just added CSS custom properties for dark mode. CodeMirror 6's theme system composes naturally with CSS-in-JS. Ace uses named theme strings that don't integrate with our variable system without extra work.

**API fit**: The current codebase is vanilla TypeScript with no framework. Both work fine in this context. CodeMirror 6's functional extension model is a better fit for composability (add/remove features without subclassing).

## Recommendation

**CodeMirror 6.**

- Half the bundle size
- Better mobile support (critical for typstmd)
- Natural dark mode integration with our CSS custom properties
- Community Typst grammar exists as a starting point
- Modular: start with markdown highlighting only, add Typst later
- Better long-term maintenance trajectory

Ace's only advantage is simpler initial setup (one function call vs composing extensions), but that's a one-time cost.

## Implementation sketch (if approved)

### Phase 1: Replace textarea with CodeMirror (Markdown mode)

Files to change:
- `web/package.json`: add `codemirror`, `@codemirror/lang-markdown`
- `web/src/main.ts`: replace textarea DOM manipulation with EditorView
- `web/index.html`: replace `<textarea>` with a container div, adjust CSS

The EditorView replaces the textarea. All existing integration points (`editor.value`, `editor.readOnly`, input events) map to CodeMirror equivalents:
- `editor.value` -> `view.state.doc.toString()`
- Setting content -> `view.dispatch({ changes: { from: 0, to: doc.length, insert: text } })`
- Input events -> `EditorView.updateListener.of(update => { if (update.docChanged) ... })`
- Read-only -> `EditorState.readOnly.of(true)` extension

### Phase 2: Dark mode theme

Create a CodeMirror theme that reads from our CSS custom properties, so light/dark switching works automatically with the existing toggle.

### Phase 3: Typst highlighting (template mode)

Evaluate the community `codemirror-lang-typst` package. If mature enough, use it directly. Otherwise, write a Lezer grammar for the Typst subset we need (set/show rules, function calls, strings, comments).

### Phase 4: Enhanced editor features (optional)

Cherry-pick features as needed:
- Bracket matching
- Auto-indent
- Line numbers (useful in template mode for debugging compile errors)
- Search/replace
