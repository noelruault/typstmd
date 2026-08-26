# AGENTS.md

Context for AI agents (Claude Code, Codex, Cursor, OpenCode, …) working on or with typstmd. `CLAUDE.md` is a symlink to this file, because Claude Code reads `CLAUDE.md` and not `AGENTS.md`.

## What typstmd is

Typstmd converts Markdown to PDF through two front-ends that share one design contract:

- **Web** (`web/`, hosted at https://noelruault.github.io/typstmd/): Markdown → remark (MDAST) → Typst string → Typst WASM compiler → PDF. Runs 100% in the browser; the document never leaves the machine.
- **CLI** (`cmd/`): Markdown → Pandoc → Typst → PDF. Shell-driven.

Both emit **standard, idiomatic, self-contained Typst**: every line of generated output must compile in the upstream `typst` compiler (0.14+) with no custom macros, no hidden context, and no Markdown syntax leaking into the Typst.

## Commands

CLI (repo root):

```bash
./cmd/converter.sh web/test/example.md              # MD → PDF, output in ./output/
./cmd/converter.sh web/test/example.md --mermaid    # + Mermaid diagram rendering
```

Web (`cd web/`):

```bash
bun install          # first time
bun run dev          # dev server on :3000, bundles src/main.ts
bun run build        # production bundle → dist/
bun test             # 250+ tests, pipeline + remark plugins
bunx tsc --noEmit    # typecheck
```

No linters. CLI has no tests.

## Authoring a template (the common task)

A template is a single Typst `.typ` file that styles the document. The web app loads one via the **Open .typ** button or by dropping the file onto the page. typstmd generates the document **body** from the user's Markdown, then composes it with the template one of three ways, auto-detected in `web/src/pipeline.ts` (`assemble`):

1. **`conf()` convention** — if the file defines `#let conf(title: none, authors: (), date: none, lang: "en", toc: false, doc) = { … doc }`, typstmd calls `#show: doc => conf(doc)` and passes the frontmatter (title/author/date/lang/toc). Use this for a full-document template. It is the Typst Universe / typst.app convention, so a starter's own `template/main.typ` works unmodified.
2. **Body marker** — put `#typstmd-body` where the body should land; typstmd substitutes it with the serialized body.
3. **Raw preamble** — anything else: typstmd appends the body after the file and passes title/author via `#set document(...)`.

Modes 2 and 3 have no `conf` to receive `lang`, so typstmd emits `#set text(lang: "…")` ahead of the template instead. It precedes the file, so a template setting its own `lang` still wins.

Rules templates must follow:

- Name only fonts the build can resolve. The browser build ships Libertinus Serif plus a small set; naming an unavailable family makes every compile warn. When unsure, do not set a font family.
- Size inline code relative to context (`0.78em`), never an absolute `pt`, or code inside a heading renders at body size.
- Keep it to one `.typ` file.

A built-in theme (for repo contributors) is a `.typ` file in `web/src/themes/`; see **Adding a theme** below.

## Typst rules that bite (each one cost a wrong attempt)

- Name only fonts the build resolves, and use **static faces**: Typst warns for every family it cannot resolve (whether or not the document uses it), and silently drops bold for variable fonts.
- Size inline code relative to context (`0.78em`), never a `pt`; `show raw: set text(size: 1em)` is a no-op because `1em` resolves against the size the outer rule already set.
- A `set` rule inside an element's own `show` rule cannot restyle that element (e.g. `set table.cell(fill: …)` from a table show rule makes the header row vanish); set fills and strokes before the element is realised.
- `box(width: 100%)` (or `height: 100%`) inside a table cell is a circular size dependency that collapses the column or blows up the row.
- Re-emitting the same element type from its own show rule recurses ("maximum show rule depth exceeded"); hand back a different construct.
- `array.join("")` returns `none` for an empty array, and an empty table cell is exactly that; guard it.
- `table.header(…)` is what repeats the header row when a table spans pages; without it page 2 loses the header.
- `outline(title: auto)` localizes the heading to the document language and is **not** numbered by `set heading(numbering: …)`; it is emitted as a level-1 heading, so the theme's own `show heading.where(level: 1)` styles it.

## Test layers (web)

Four layers, and the last two exist because the first two cannot see a rendered page:

| Layer | File | Catches |
| --- | --- | --- |
| Emitted string | `mdast-to-typst.test.ts`, `fixtures/`, `template-assembly.test.ts` | wrong Typst |
| CLI/web parity | `parity.test.ts` | the two front-ends drifting apart. Sanctioned divergences are asserted in that file, not waved away. Needs `pandoc` |
| Rendered PDF | `render.test.ts` | deleted text, a title at body size, a missing font, a table losing its header. Uses `typst` + `pdftotext`/`pdffonts` and `--ignore-system-fonts` so the font set matches the browser |
| Compile time | `bench-compile.ts` | a change doubling what users wait for. `bun run bench` gates locally against `perf-baseline.json`; `bun run bench:update` re-records it. A theme whose `.typ` is gitignored is skipped, because the baseline is committed |

A green `bun test` was never enough on its own: every defect the parity work fixed passed the string layer. CI installs pinned `typst`, `pandoc` and poppler so no layer can silently skip.

Visual fixtures remain for what no assertion covers, i.e. whether a page *looks* right. **When changing anything that affects rendered layout, table sizing, cell wrapping, spacing or theme templates, eyeball a fixture too.**

Visual fixtures live in `web/test/visuals/*.md`. Each file collects markdown cases that target specific layout failure modes (e.g. `tables.md` covers column-sizing and long-token wrapping). To check a change, run `bun run dev`, paste a fixture and eyeball the PDF. When you fix a layout bug, add a fixture case that reproduces it to the relevant file so the failure mode is documented and re-checkable.

## Theme spacing rules (vertical rhythm + WCAG)

The `default` theme's spacing is a tuned system, not a bag of independent numbers. Change one value in isolation and you break the hierarchy that took several rounds to get right. Before touching any `leading` / `spacing` / `above` / `below` in `web/src/themes/default.typ`, keep these invariants:

- **Ordering (non-negotiable):** `space above a heading` > `space between paragraphs` > `space below a heading` > `space between lines`. A heading must clearly separate from the previous section (large `above`), bind to the body it introduces (small `below`), and a heading that wraps must read as one title (tight internal `leading`), not as several stacked titles.
- **Line height** — `par(leading: 0.85em)` measures to a 1.5 line-height ratio, the WCAG 2.2 SC 1.4.12 minimum. It is applied to body, every heading level, and quotes so the whole document shares one rhythm. This value was measured with Typst's `measure()`, not guessed — re-measure if you change the body font (the em-to-line-height ratio is font-metric dependent).
- **Paragraph spacing** — `par(spacing: 2em)` is 2× the 12pt font, the WCAG 1.4.12 minimum. If you raise it, you MUST raise every heading `above` to keep it larger.
- **Heading `above`** must exceed paragraph spacing (h1 2.8em down to h6 2.2em, all > 2em). **Heading `below`** must stay under it (~1em, scaling by level) so the heading groups with its content instead of floating free.
- **Letter-spacing and word-spacing are deliberately NOT baked in.** WCAG 1.4.12 only requires that content survive a *user* applying `tracking` / word-spacing; hard-coding them (`text(tracking:)` / `text(spacing:)`) alters the typeface's texture and reads as a font change. Leave them to the reader/browser.
- **Code blocks are exempt** — `raw` keeps its own tight `leading` and normal letter spacing so monospace stays aligned.

`academic.typ` / `aitelier.typ` share the same wrapped-heading leading fix and should follow the same ordering. The `ieee` theme is governed by the IEEE spec instead (verified page geometry from `ieee-pages-and-margins-2016.pdf`, numbered headings, dedicated cover + TOC pages, body page numbers) — do not apply the default theme's values to it.

## The `report` theme

The `report.typ` theme mirrors a generated penetration-test report: cover page with a charcoal title band, a dotted-leader contents page, section titles over a heavy rule, severity pills, a findings table with a dark header, and a metadata card per finding. Set in **Arimo** (Helvetica-metric, OFL), a non-embedded face `fontsFor` loads by URL from the `FONT_URLS` map (see `themes/index.ts`) because the `.typ` names it.

Three conventions it reads out of ordinary Markdown, all documented in `web/test/visuals/pentest-report.md`:

| Markdown | Renders as |
| --- | --- |
| A table with **2 columns** | The metadata card; its GFM header row is hidden |
| A table with **3+ columns** | A data table with the dark header band |
| A cell or `**strong**` that is *only* a severity word | A coloured pill (`Critical`, `High`, `Medium`, `Low`, `Informational`, `Unknown`) |

The pill only substitutes when the cell says nothing else, so prose containing "high" is untouched.

Table fill and strokes are set **before** any table exists, because a `set` rule inside a table's own `show` rule cannot restyle that table. Two things that look like they should work and do not: wrapping a cell in `box(width: 100%)` (circular width dependency, the column collapses) and `set table.cell(fill: …)` from a show rule (the header row disappears).

The pill substitution returns `table.cell(align: horizon, badge(…))`, not a bare `badge(…)`: content handed back from a `show table.cell` rule ignores the table's `align`, so a bare badge floats at the top of a tall wrapped row. Rebuilding the cell makes the pill inherit the centring; it re-enters the rule once (the new body is a box, no severity word) and stops. `box(height: 100%)` to fill the row is the same circular trap as `box(width: 100%)` and blows the row up.

## Adding a theme

A theme is one `.typ` file: `web/src/themes/<id>.typ`, plain Typst that any Typst user could compile. Drop it in, nothing else: `plugins/content-themes.ts` scans `*.typ` and generates `registry.gen.ts`, deriving the id and display name from the filename (`report.typ` → id `report`, name "Report") and defaulting fonts to the embedded set. It runs from the dev server, the build, `bun test`'s preload, and `bun run gen:themes` (also on `bun install`). The picker is built from the registry at runtime, and `themes.test.ts` plus `render.test.ts` pick the new theme up automatically. No per-theme TypeScript, no metadata sidecar; logos inline as SVG (`image(bytes("<svg…>"), format: "svg")`).

Two rules the tests enforce, both learned the hard way:

- **Name only a font it can load**: either an embedded face (Libertinus Serif, New Computer Modern, DejaVu Sans Mono, from `typst fonts --ignore-system-fonts`) or a non-embedded one listed in `FONT_URLS` in `themes/index.ts` (Arimo, Barlow, Montserrat), which `fontsFor` fetches by URL for exactly the faces a `.typ` names. Anything else renders a fallback and cannot be validated; `themes.test.ts` fails it. `render.test.ts` fetches the URL faces under `TYPSTMD_NETWORK_TESTS=1` (set in CI) to compile those themes on real Typst; add a new URL face by dropping it in `FONT_URLS`.
- **Size code relative to its context** (`0.78em`, not `9pt`). An absolute size renders inline code inside a heading at body size, and the obvious fix, `show raw: set text(size: 1em)`, is a no-op because `1em` resolves against the size the outer rule already set.

Themes are for documents. The tighter rhythm of a CV belongs in a template, not a theme; `aitelier` carries the palette and the mono section-label motif of `noel.engineer/resume` on the document spacing contract above.

## One template picker

Themes, Universe starters and brought-in files are all templates, so the toolbar has one `#template-select` with three groups. A selection is `kind:id` (`theme:aitelier`, `starter:charged-ieee`, `user:cv.typ`) because a bare id cannot tell a theme called `ieee` from a package called `ieee`; `src/template-selection.ts` parses it and resolves the source, preferring a Template-view edit over the pristine one.

Only a **theme** carries a font descriptor. A package or a brought-in file gets the default set, which is every face the browser build loads, so `fontThemeId()` falls back to `default` for them.

Template-view edits are stored per selection (`typstmd:template:theme:aitelier`), and the active selection persists in `typstmd:template-selection`. `migrateLegacyTemplateKeys()` moves the old per-theme keys across; without it, anyone who had customised a theme loses that edit the first time they load the unified picker.

## Bringing in a template

Any `.typ` file is a template: drop it on the page or use **Open .typ**. It is saved under its filename (`typstmd:user-template:<name>`, see `src/user-templates.ts`), listed in the toolbar picker under "Yours" beside the built-in starters, and re-adding the same name asks before replacing it. `src/dropped-file.ts` decides what a brought-in file is: `.typ` is a template, markdown is the document, anything else is an image mapped into the VFS.

Persistence is `localStorage`, so it is per-browser. Publishing a dropped template so others can use it would need a server, which the client-only decision below rules out.

## Universe starters

`web/src/starters.ts` holds preambles for Typst Universe templates, loaded into the Template view from the toolbar. They are **not** copied theme code: the package is fetched at a pinned version, so the rendering stays upstream's and every parameter it exposes stays reachable.

Derive a new starter from that package's own `template/main.typ`, never by hand. Argument types are not guessable (`basic-resume` wants `author: "string"`, `charged-ieee` wants `department: [content]`), and a wrong one only surfaces on compile. `TYPSTMD_NETWORK_TESTS=1 bun test test/render.test.ts` compiles every starter for exactly this reason; it is opt-in because it downloads packages.

Because unit tests only assert the generated Typst *string*, a spacing regression will pass `bun test`. Verify spacing changes by rendering — `web/test/visuals/headings.md` is the fixture for this.

## CLI pipeline architecture

Linear, self-contained:

1. `cmd/converter.sh`: entry point. Validates deps, parses `--mermaid`, invokes Pandoc with a **pinned reader dialect** (`READER_DIALECT`) that mirrors the web's remark plugin set. Bare `markdown` would grant ~40 extensions the web has never had; `smart` must stay on or the CLI escapes `--` and `"` that the web leaves for Typst.
2. Pandoc applies:
   - `cmd/filters/table.lua`: emits the same `#table(columns: …, table.header(…), …)` shape as `serializeTable` in the web serializer, including the same column-width heuristic. Keep the two in sync; a table split across pages loses its header without `table.header`.
   - `cmd/filters/mermaid.lua`: with `--mermaid` (which passes `-M mermaid=true`), injects `#import "@preview/merman"` + `show raw.where(lang: "mermaid"): show-mermaid-blocks()`, the exact two lines `pipeline.ts` injects on the web, so a mermaid fence draws as a real Typst diagram in the upstream compiler. Without the flag the fence prints its source, byte-identically on both sides. `parity.test.ts` asserts equality in **both** states. Rendering stays Typst content (not a PNG), so the `.typ` reproduces the diagram anywhere merman resolves; the old `mermaid-filter`/`mermaid-cli` PNG path is gone.
   - `cmd/templates/md-template.typ`: Typst template for all PDF styling (A4, Libertinus Serif 12pt, headers/footers, code/quote/table). Pandoc template with `$variable$` interpolation, not pure Typst.
3. Typst (as Pandoc `--pdf-engine`) compiles to PDF.

Front matter (`title`, `author`, `date`, `lang`, `toc`) interpolated into the title block.

## Web pipeline architecture (`web/`)

100% browser, no server. Entry: `src/main.ts` mounts CodeMirror + wires compile loop.

**Pipeline** (`src/pipeline.ts` → `markdownToTypst`):
1. `remark-parse` + `remark-frontmatter` + `remark-gfm` + local plugins (`remark-emoji`, `remark-hard-breaks`, `remark-sub-super`, `remark-highlight`) produce MDAST.
2. `mdast-to-typst.ts` serializes MDAST → Typst string. Escaping lives in `typst-escape.ts`. Warnings collected in `warnings.ts`.
3. Typst template (per theme) wraps the body.
4. `typst-compiler.ts` (WASM, `@myriaddreamin/typst-ts-web-compiler`) runs in a Web Worker and compiles → PDF bytes → Blob URL → `<iframe>`.

**Front matter** (`src/frontmatter.ts`): `title`, `author`, `date`, `lang`, `toc` are the five keys typstmd acts on; every other key is passed through untouched as a `frontmatter` dictionary the template can read. `lang` is validated as an ISO 639 code before it is interpolated into a string literal in the generated Typst.

**Emoji and mermaid** are injected by `pipeline.ts` only when the body uses them (the same shape as `needsEmojiFont`), never baked into a theme, so every template gets them and one with no emoji/diagram pays nothing. `MERMAID_PREAMBLE` there is the single source of truth for the injected block; `cmd/filters/mermaid.lua` mirrors it **byte-for-byte** so the CLI and web agree, and `parity.test.ts` asserts equality with the switch both off (fence prints its source) and on (both draw). Gate it with the web `mermaid` option (default on) or the CLI `--mermaid`. The show rule (`show-mermaid-blocks`) reads the fence's `.text`, so a theme's own `show raw` rules cannot corrupt the parsed diagram; it is wrapped `align(center, show-mermaid-blocks(width: 62%)(it))` so a pie or bar sits centred and does not fill the page. A long `xychart` category label clips at the plot edge (right when vertical, left when `chartOrientation: horizontal`); it is a mermaid limitation neither `viewport-width` nor orientation cures, so it is left as-is. **merman needs typst 0.14+**, which is why the compiler is pinned to `@myriaddreamin/typst-ts-web-compiler@0.7.0` (typst 0.14.2), not 0.6.0 (0.13.1). The compile runs in a **Web Worker with a timeout** (`compile-client.ts` → `compile-worker.ts`): a pathological document that would OOM or hang cannot freeze the UI thread or crash the tab; it surfaces an error and the worker respawns.

**Editor** (`src/highlight/`): CodeMirror 6. `index.ts` exposes `createEditorView` / `getValue` / `setValue` / `setReadOnly` / `setHighlightTheme`. Themes live in `src/highlight/themes/*.ts`. See `src/highlight/themes/CONTRIBUTING.md` for adding one.

**Themes plugin** (`plugins/themes.ts`): Bun build-time plugin. Scans `src/highlight/themes/*.ts`, emits a virtual `virtual:themes` module exporting `allThemes`. `index.ts` consumes it. Drop a new theme file → rebuild → it appears. Plugin is wired into both `src/dev-server.ts` and `build.ts`. TS declaration: `src/virtual-modules.d.ts`.

**UI state**: `main.ts` owns view modes (`editor` / `source` / `template`). Custom Typst templates persisted via `template-storage.ts` (localStorage). Highlight dropdown populated at runtime from the `highlightThemes` registry, so no `<option>` entries are hand-edited.

**Dev server** (`src/dev-server.ts`): bundles on startup with `Bun.build()` + themes plugin. Serves `index.html`, bundled `/main.js`, and the Typst WASM blob from `node_modules/`. Sets COOP/COEP headers (`SharedArrayBuffer` required by WASM compiler).

## Dependencies

CLI:
- **pandoc** + **typst** required (script exits if missing). `--mermaid` needs no extra tool: typst fetches the `merman` package. typst must be **0.14+** for merman.

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

## Decisions the code does not show

**Client-only, deliberately.** The web app is a static site and the CLI runs on the user's own machine; there is no hosted md→pdf endpoint and adding one has been rejected. GitHub Pages is static-only, GHCR stores images but does not execute them, and GitHub has no free container-serving product. A Cloudflare Worker cannot run pandoc or native typst (V8 isolates, no subprocess) and the free tier is static-only either way. A real endpoint means external scale-to-zero compute plus sandboxing of untrusted input. If a single binary is ever genuinely wanted, the path that also raises parity is to drop pandoc and reuse `markdownToTypst` in a Bun or Go wrapper, embedding only typst and the fonts — pandoc is GPLv2+ and ~170MB, so bundling it infects the distribution.

**Theme fonts are fetched at runtime.** The build embeds Libertinus Serif, New Computer Modern and DejaVu Sans Mono; every other face a theme names is fetched from the URLs in `FONT_URLS` when the document compiles. Offline use therefore does not fail loudly — Typst falls back and the layout, line breaks and page count change with it. Do not claim offline support without bundling those faces locally. The emoji font cannot be bundled at any sensible size (Noto Color Emoji is ~10MB).

## llms.txt

`web/llms.txt` is the LLM-facing site summary in [llms.txt](https://llmstxt.org) format; `build.ts` copies it into `dist/`, so it deploys to the site root alongside the app (dev serves it at `/llms.txt` automatically).

Update it in the same change whenever a fact it states drifts: a pipeline's shape, the kinds of templates on offer, the hosted URL, or the set of top-level docs it links. Its links must target files that exist on `main` (raw.githubusercontent.com URLs), because the file deploys from main and a dead link ships silently.

## Known limitations

Check GitHub Issues labeled `improvement`:

```bash
gh issue list --label improvement
```

When asked to improve this project, check these issues first and attempt any that are unblocked.
