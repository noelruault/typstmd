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

## Test layers (web)

Four layers, and the last two exist because the first two cannot see a rendered page:

| Layer | File | Catches |
| --- | --- | --- |
| Emitted string | `mdast-to-typst.test.ts`, `fixtures/`, `template-assembly.test.ts` | wrong Typst |
| CLI/web parity | `parity.test.ts` | the two front-ends drifting apart. Sanctioned divergences are asserted in that file, not waved away. Needs `pandoc` |
| Rendered PDF | `render.test.ts` | deleted text, a title at body size, a missing font, a table losing its header. Uses `typst` + `pdftotext`/`pdffonts` and `--ignore-system-fonts` so the font set matches the browser |
| Compile time | `bench-compile.ts` | a change doubling what users wait for. `bun run bench` gates locally against `perf-baseline.json`; `bun run bench:update` re-records it |

A green `bun test` was never enough on its own: every defect the parity work fixed passed the
string layer. CI installs pinned `typst`, `pandoc` and poppler so no layer can silently skip.

Visual fixtures remain for what no assertion covers, i.e. whether a page *looks* right.
**When changing anything that affects rendered layout, table sizing, cell wrapping, spacing or
theme templates, eyeball a fixture too.**

Visual fixtures live in `web/test/visuals/*.md`. Each file collects
markdown cases that target specific layout failure modes (e.g.
`tables.md` covers column-sizing and long-token wrapping). To check a
change:

```bash
bun run dev              # :3000, paste a fixture and eyeball the PDF
```

When you fix a layout bug, add a fixture case that reproduces it to the
relevant file so the failure mode is documented and re-checkable.

## Theme spacing rules (vertical rhythm + WCAG)

The `default` theme's spacing is a tuned system, not a bag of independent numbers. Change one value in isolation and you break the hierarchy that took several rounds to get right. Before touching any `leading` / `spacing` / `above` / `below` in `web/src/themes/default.ts`, keep these invariants:

- **Ordering (non-negotiable):** `space above a heading` > `space between paragraphs` > `space below a heading` > `space between lines`. A heading must clearly separate from the previous section (large `above`), bind to the body it introduces (small `below`), and a heading that wraps must read as one title (tight internal `leading`), not as several stacked titles.
- **Line height** — `par(leading: 0.85em)` measures to a 1.5 line-height ratio, the WCAG 2.2 SC 1.4.12 minimum. It is applied to body, every heading level, and quotes so the whole document shares one rhythm. This value was measured with Typst's `measure()`, not guessed — re-measure if you change the body font (the em-to-line-height ratio is font-metric dependent).
- **Paragraph spacing** — `par(spacing: 2em)` is 2× the 12pt font, the WCAG 1.4.12 minimum. If you raise it, you MUST raise every heading `above` to keep it larger.
- **Heading `above`** must exceed paragraph spacing (h1 2.8em down to h6 2.2em, all > 2em). **Heading `below`** must stay under it (~1em, scaling by level) so the heading groups with its content instead of floating free.
- **Letter-spacing and word-spacing are deliberately NOT baked in.** WCAG 1.4.12 only requires that content survive a *user* applying `tracking` / word-spacing; hard-coding them (`text(tracking:)` / `text(spacing:)`) alters the typeface's texture and reads as a font change. Leave them to the reader/browser.
- **Code blocks are exempt** — `raw` keeps its own tight `leading` and normal letter spacing so monospace stays aligned.

`minimal.ts` / `academic.ts` / `aitelier.ts` share the same wrapped-heading leading fix and should follow the same ordering. The `ieee` theme is governed by the IEEE spec instead (verified page geometry from `ieee-pages-and-margins-2016.pdf`, numbered headings, dedicated cover + TOC pages, body page numbers) — do not apply the default theme's values to it.

## Adding a theme

`web/src/themes/<id>.ts` exporting a `Theme`, then register it in `themes/index.ts`. Nothing else: the picker is built from the registry at runtime, and `themes.test.ts` plus `render.test.ts` pick the new theme up automatically.

Two rules the tests enforce, both learned the hard way:

- **Name only fonts the theme declares** in its `fonts` descriptor. Typst warns for every family it cannot resolve, whether or not the document uses it, so a stray family in a fallback list means a warning on every compile.
- **Size code relative to its context** (`0.78em`, not `9pt`). An absolute size renders inline code inside a heading at body size, and the obvious fix, `show raw: set text(size: 1em)`, is a no-op because `1em` resolves against the size the outer rule already set.

Themes are for documents. The tighter rhythm of a CV belongs in a template, not a theme; `aitelier` carries the palette and the mono section-label motif of `noel.engineer/resume` on the document spacing contract above.

## One template picker

Themes, Universe starters and brought-in files are all templates, so the toolbar has one `#template-select` with three groups. A selection is `kind:id` (`theme:aitelier`, `starter:charged-ieee`, `user:cv.typ`) because a bare id cannot tell a theme called `ieee` from a package called `ieee`; `src/template-selection.ts` parses it and resolves the source, preferring a Template-view edit over the pristine one.

Only a **theme** carries a font descriptor. A package or a brought-in file gets the default set, which is every face the browser build loads, so `fontThemeId()` falls back to `default` for them.

Template-view edits are stored per selection (`typstmd:template:theme:aitelier`), and the active selection persists in `typstmd:template-selection`. `migrateLegacyTemplateKeys()` moves the old per-theme keys across; without it, anyone who had customised a theme loses that edit the first time they load the unified picker.

## Bringing in a template

Any `.typ` file is a template: drop it on the page or use **Open .typ**. It is saved under its filename (`typstmd:user-template:<name>`, see `src/user-templates.ts`), listed in the toolbar picker under "Yours" beside the built-in starters, and re-adding the same name asks before replacing it. `src/dropped-file.ts` decides what a brought-in file is: `.typ` is a template, markdown is the document, anything else is an image mapped into the VFS.

Persistence is `localStorage`, so it is per-browser. Publishing a dropped template so others can use it is the Cloudflare storage work in `.plans/3-cloudflare-worker-optional-storage` and `.plans/7-cloudflare-hosted-conversion`, not this.

## Universe starters

`web/src/starters.ts` holds preambles for Typst Universe templates, loaded into the Template view from the toolbar. They are **not** copied theme code: the package is fetched at a pinned version, so the rendering stays upstream's and every parameter it exposes stays reachable.

Derive a new starter from that package's own `template/main.typ`, never by hand. Argument types are not guessable (`basic-resume` wants `author: "string"`, `charged-ieee` wants `department: [content]`, `dashing-dept-news` has no `subtitle` at all), and a wrong one only surfaces on compile. `TYPSTMD_NETWORK_TESTS=1 bun test test/render.test.ts` compiles every starter for exactly this reason; it is opt-in because it downloads packages.

Because unit tests only assert the generated Typst *string*, a spacing regression will pass `bun test`. Verify spacing changes by rendering — `web/test/visuals/headings.md` is the fixture for this.

## CLI pipeline architecture

Linear, self-contained:

1. `cmd/converter.sh`: entry point. Validates deps, parses `--mermaid`, invokes Pandoc with a **pinned reader dialect** (`READER_DIALECT`) that mirrors the web's remark plugin set. Bare `markdown` would grant ~40 extensions the web has never had; `smart` must stay on or the CLI escapes `--` and `"` that the web leaves for Typst.
2. Pandoc applies:
   - `cmd/filters/table.lua`: emits the same `#table(columns: …, table.header(…), …)` shape as `serializeTable` in the web serializer, including the same column-width heuristic. Keep the two in sync; a table split across pages loses its header without `table.header`.
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
