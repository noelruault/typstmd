# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Typstmd converts Markdown to PDF. Two front-ends, shared design rules:

- **CLI** (`cmd/`): Markdown → Pandoc → Typst → PDF. Shell-driven.
- **Web** (`web/`): Markdown → remark (MDAST) → Typst string → Typst WASM → PDF. Runs 100% in-browser.

## Commands

CLI (repo root):

```bash
./cmd/converter.sh example.md              # MD → PDF, output in ./output/
./cmd/converter.sh example.md --mermaid    # + Mermaid diagram rendering
```

Web (`cd web/`):

```bash
bun install          # first time
bun run dev          # dev server on :3000, bundles src/main.ts
bun run build        # production bundle → dist/
bun test             # 130+ tests, pipeline + remark plugins
bunx tsc --noEmit    # typecheck
```

No linters. CLI has no tests.

## Visual testing (web)

Unit tests assert the generated Typst *string*; they cannot catch
layout bugs (column overlap, text overflowing a cell, table running off
the page). Those only show up in the rendered PDF. **When changing
anything that affects rendered layout — table sizing, cell wrapping,
spacing, theme templates — also verify visually, don't rely on
`bun test` alone.**

Visual fixtures live in `web/test/visuals/*.md`. Each file collects
markdown cases that target specific layout failure modes (e.g.
`tables.md` covers column-sizing and long-token wrapping). To check a
change:

```bash
bun run dev              # :3000, paste a fixture and eyeball the PDF
```

When you fix a layout bug, add a fixture case that reproduces it to the
relevant file so the failure mode is documented and re-checkable.

## CLI pipeline architecture

Linear, self-contained:

1. `cmd/converter.sh`: entry point. Validates deps, parses `--mermaid`, invokes Pandoc.
2. Pandoc applies:
   - `cmd/filters/auto-table-widths.lua`: resets Pandoc's guessed column widths to `ColWidthDefault` so Typst auto-sizes tables.
   - Optional: `mermaid-filter` (npm) renders Mermaid code blocks to PNG.
   - `templates/md-template.typ`: Typst template for all PDF styling (A4, Libertinus Serif 12pt, headers/footers, code/quote/table). Pandoc template with `$variable$` interpolation, not pure Typst.
3. Typst (as Pandoc `--pdf-engine`) compiles to PDF.

Front matter (`title`, `author`, `date`) interpolated into title block.

## Web pipeline architecture (`web/`)

100% browser, no server. Entry: `src/main.ts` mounts CodeMirror + wires compile loop.

**Pipeline** (`src/pipeline.ts` → `markdownToTypst`):
1. `remark-parse` + `remark-frontmatter` + `remark-gfm` + local plugins (`remark-emoji`, `remark-hard-breaks`, `remark-sub-super`, `remark-highlight`) produce MDAST.
2. `mdast-to-typst.ts` serializes MDAST → Typst string. Escaping lives in `typst-escape.ts`. Warnings collected in `warnings.ts`.
3. Typst template (per theme) wraps the body.
4. `typst-compiler.ts` (WASM, `@myriaddreamin/typst-ts-web-compiler`) compiles → PDF bytes → Blob URL → `<iframe>`.

**Editor** (`src/highlight/`): CodeMirror 6. `index.ts` exposes `createEditorView` / `getValue` / `setValue` / `setReadOnly` / `setHighlightTheme`. Themes live in `src/highlight/themes/*.ts`. See `src/highlight/themes/CONTRIBUTING.md` for adding one.

**Themes plugin** (`plugins/themes.ts`): Bun build-time plugin. Scans `src/highlight/themes/*.ts`, emits a virtual `virtual:themes` module exporting `allThemes`. `index.ts` consumes it. Drop a new theme file → rebuild → it appears. Plugin is wired into both `src/dev-server.ts` and `build.ts`. TS declaration: `src/virtual-modules.d.ts`.

**UI state**: `main.ts` owns view modes (`editor` / `source` / `template`). Custom Typst templates persisted via `template-storage.ts` (localStorage). Highlight dropdown populated at runtime from the `highlightThemes` registry, so no `<option>` entries are hand-edited.

**Dev server** (`src/dev-server.ts`): bundles on startup with `Bun.build()` + themes plugin. Serves `index.html`, bundled `/main.js`, and the Typst WASM blob from `node_modules/`. Sets COOP/COEP headers (`SharedArrayBuffer` required by WASM compiler).

## Dependencies

CLI:
- **pandoc** + **typst** required (script exits if missing).
- **mermaid-filter** + **@mermaid-js/mermaid-cli** optional, only for `--mermaid`.

Web:
- **bun** runtime handles build, dev server, and tests from a single tool.
- npm: `codemirror`, `@codemirror/lang-markdown`, `@codemirror/language-data`, `@myriaddreamin/typst.ts`, `@myriaddreamin/typst-ts-web-compiler`, `unified`/`remark-*`, `yaml`.

## Strict design guideline: Markdown/Typst separation

Applies to **both** pipelines. Two clean boundaries:

1. **Markdown layer** (remark plugins / Pandoc filters): transforms markdown syntax into MDAST (web) or Pandoc AST (CLI). All markdown-specific logic (emoji shortcodes, subscript syntax, GFM extensions) resolved here. No Typst leaks in.
2. **Typst layer** (serializer output): emits real, valid, idiomatic Typst. Every line of generated output must be standalone Typst that any user could paste into a `.typ` file and compile independently.

**Rules:**
- Never invent custom Typst syntax, non-standard macros, or a hybrid format.
- Never blend markdown syntax into Typst output.
- Generated Typst must not depend on hidden context that isn't present in the output itself.
- Plugins operate at the markdown parse layer (remark plugins) or produce standard Typst constructs. They must not change the core authoring model.
- The source view must show code that any Typst user would recognize as plain Typst.
- Only add plugin-specific Typst features when genuinely necessary (e.g., icon support not available natively in Typst).

## Known limitations

Check GitHub Issues labeled `improvement`:

```bash
gh issue list --label improvement
```
