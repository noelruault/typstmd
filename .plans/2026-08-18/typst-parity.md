---
plan: typst-parity
title: Make typstmd (web) match Typst and the Pandoc CLI, and pair the CV templates
created: 2026-08-18
owner: @noelruault
status: approved
walkthrough:
  last_run: 2026-08-20T15:46:12Z
  completed_at: 2026-08-20T15:46:12Z
execution:
  started: null
  completed: null
  prs: []
branch: typst-pairing
repos:
  - noelruault/typstmd
  - noelruault/website (resume/)
---

## 1. Summary

The CV rendered through typstmd (web) does not match `resume/noel-ruault-cv.pdf` compiled by Typst directly. Two separate causes, and only one of them is the template's fault.

First, typstmd's web pipeline is not a faithful Markdown→Typst converter: it silently eats `~`, turns `~word word~` into a subscript that swallows a whole clause, injects placeholder prose into the document, clamps heading levels, and asks the WASM compiler for a font that is not in its bundle. Several of these behaviours disagree with typstmd's *own* CLI front-end (Pandoc), which is the closer-to-correct implementation. Every item in §2.1–§2.8 was reproduced against the code in this repo at `main` (11d462a) and is quoted with the command that produced it.

Second, `resume/template/cv-typstmd.typ` draws the identity header itself while a normally-written CV Markdown also carries one, so the header renders twice. That is a contract bug in the template, fixed in §2.9–§2.12.

Baseline before touching anything: `bun test` in `web/` is **139 pass / 0 fail** (`bun test`, 5.89s). No change in this plan may reduce that.

**Nothing in this plan was broken by the CV work.** The typstmd working tree already had 7 modified files plus an untracked `web/src/themes/ieee.ts` when this started; every one of them is dated `Jul 24`, predating the CV session, and the CV work only ever read from this repo. `git status` before starting: `M CLAUDE.md, M templates/md-template.typ, M web/index.html, M web/src/themes/{academic,default,index,minimal}.ts, ?? web/src/themes/ieee.ts, ?? .plans/7-cloudflare-hosted-conversion/`.

All work lands on branch `typst-pairing`, cut from `main`. The branch does not exist yet (`git branch -a`: `main`, `legacy`, `remotes/origin/{main,legacy,feature/web}`).

### The rule this plan applies

**Typst is the reference.** Emitted code must be plain, idiomatic Typst that a Typst user would recognise, and rendered output must be what Typst does with it.

**CommonMark + a pinned extension set is the reference for what the Markdown means** (§2.5a fixes the list in place of Pandoc's kitchen-sink defaults).

**Pandoc is not an authority, it is the CLI front-end's converter.** It is used here as a cross-check: it is a mature implementation, so where it disagrees with the web pipeline that disagreement is worth explaining. Every fix below still has to justify itself on Typst grounds alone, and where Pandoc's habits are not Typst's (wrapping every table in a centred `#figure`), Typst wins.

**The invariant:** one Markdown file produces the same Typst from either front-end. `+++` is the single invented syntax and both sides already implement the same rule for it.

### Evidence table (all reproduced, not inferred)

Same input file through both front-ends:

| Markdown | Pandoc CLI → Typst | typstmd web → Typst | Verdict |
|---|---|---|---|
| `~10 years` | `\~10 years` | `~10 years` | web bug: Typst reads `~` as a non-breaking space, tilde disappears |
| `~300 paying subscribers at €50/mo (~€15k MRR)` | `\~300 … (\~€15k MRR)` | `#sub[300 paying subscribers at €50/mo (]€15k MRR)` | web bug: subscript across spaces, breaks the parens (this is the CV screenshot) |
| `H~2~O` | `H#sub[2]O` | `H#sub[2]O` | agree |
| `x^2^` | `x#super[2]` | `x#super[2]` | agree |
| `==important==` | `==important==` (literal) | `#highlight[important]` | web-only dialect |
| `#### h4` / `##### h5` / `###### h6` | `====` / `=====` / `======` | `===` / `===` / `===` | web bug: clamped to level 3 |
| `<div>raw html block</div>` | `#block[raw]` (keeps text) | `\[HTML block removed\]` + warning | divergent; web injects prose into the document |
| `![local](p.png)` | `#figure(image("p.png"))` | `#figure(image("p.png"))` → `error: file not found` in the browser | web bug: no VFS entry can ever satisfy it |
| `![remote](https://…)` | `#figure(image("https://…"))` | `\[Image: remote\]` | divergent; both broken, differently |
| `+++` alone | `#pagebreak()` (via `cmd/filters/pagebreak.lua`) | `#pagebreak()` (`mdast-to-typst.ts:212-221`) | agree, but both are custom syntax |
| `--` / `---` / `...` / `"x"` | passed through | passed through | agree; Typst's own smart replacements apply. Correct, leave alone |

Reproduce with:

```bash
cd web && bun -e 'import {markdownToTypst} from "./src/pipeline"; console.log(markdownToTypst(await Bun.file("PROBE.md").text()).typstSource)'
pandoc -f markdown -t typst PROBE.md
```

## 2. Changes

### Testing contract (applies to every change below)

Every change that alters emitted Typst or rendered output ships with all four:

1. **Coded assertion** on the emitted Typst string (`web/test/mdast-to-typst.test.ts`, `typst-escape.test.ts`, or `fixtures/`).
2. **Pandoc parity assertion** where the construct exists in both front-ends: the web output must equal `pandoc -f markdown -t typst` after whitespace normalisation (§2.8 builds the harness).
3. **Automated render assertion** in a new `web/test/render.test.ts`, extending the pattern already in `test/compile-smoke.test.ts` (shells out to `typst`, skips when absent). Compile with `typst compile --ignore-system-fonts` so the font set matches the browser exactly, then assert on `pdftotext` output (text that must survive) and `pdffonts` output (faces that must be embedded). Deterministic, no pixel baselines to flake.
4. **Visual fixture case** appended to the matching `web/test/visuals/*.md` so a human can eyeball it via `bun run dev`.

Back-fill for the three changes approved before this contract existed: §2.1 asserts `~10 years` survives into `pdftotext`; §2.2 asserts the full `300 paying subscribers at €50/mo (~€15k MRR)` survives as one run; §2.3 asserts the six heading levels render at six distinct sizes.

### 2.1 typstmd: escape `~` in `escapeText`
✅ APPROVED 2026-08-18

**File:** `web/src/typst-escape.ts:12`

`TEXT_SPECIAL = /[#@$\\*_`<>\[\]]/g` omits `~`. In Typst markup `~` is a non-breaking space, so every stray tilde is deleted from the output. Verified: `Site Reliability and DevOps engineer with ~10 years` renders as `with  10 years`.

Add `~` to the class. Verified that the escape works: a `.typ` containing `a \~10 years` renders `a ~10 years` (`pdftotext`).

Pandoc already does exactly this (`\~10 years`), so this is web-catches-up-to-CLI, not a new dialect.

Test to add in `web/test/typst-escape.test.ts`: `escapeText("~10")` → `"\\~10"`.

### 2.2 typstmd: make `~sub~` / `^super^` reject inner whitespace (match Pandoc)
✅ APPROVED 2026-08-18

**File:** `web/src/remark-sub-super.ts`

Pandoc's `subscript`/`superscript` extensions forbid unescaped spaces inside the delimiters, which is why `~300 paying subscribers at €50/mo (~` stays literal there and becomes a clause-swallowing `#sub[…]` here. This single rule is the whole CV formatting bug: tiny text, broken parenthesis pairing.

Restrict the plugin's match to runs with no whitespace. `H~2~O` and `x^2^` keep working (both already agree with Pandoc); prose tildes stop being markup.

Existing tests at `web/test/mdast-to-typst.test.ts:179-189` cover the no-space forms only, so they should stay green. Add two regression cases: `~300 subs at €50/mo (~€15k)~` stays literal, and `a ~ b` stays literal.

### 2.3 typstmd: stop clamping heading levels 4-6
✅ APPROVED 2026-08-18

**File:** `web/src/mdast-to-typst.ts` (`case "heading"`, `Math.min(h.depth, 3)`)

`####`/`#####`/`######` all collapse to `===`. Typst supports levels 4-6 natively, Pandoc emits them, and this repo's own themes already style them: `web/src/themes/default.ts:103-122` has `heading.where(level: 4|5|6)` show rules that the web path can never trigger. Dead code today, correct behaviour after the fix.

Emit `"=".repeat(h.depth)`. Check `web/test/mdast-to-typst.test.ts` and `web/test/fixtures/headings.typ` for expectations that hard-code the clamp; those fixtures need regenerating.

### 2.4 typstmd: fix the font name the web themes ask for
✅ APPROVED 2026-08-18

**Files:** `web/src/themes/default.ts:13`, `web/src/themes/minimal.ts:13`, `web/src/themes/ieee.ts:26`

All three set `font: "Linux Libertine"`. The browser compiler preloads `assets: ["text"]`, which is `LibertinusSerif-*.otf`, `NewCM*.otf`, `DejaVuSansMono*.ttf` (`node_modules/@myriaddreamin/typst.ts/dist/esm/options.init.mjs:7-25`). There is no "Linux Libertine" in that bundle, so Typst warns `unknown font family: linux libertine` three times per compile. It then falls back to its own default face, which in Typst 0.14 *is* Libertinus Serif: `pdffonts` on the compiled output lists `LibertinusSerif-{Regular,Semibold,Bold}` + `DejaVuSansMono`, so the rendered typeface is already correct by accident. This is warning noise and a lie about intent, not a visible typeface divergence. The same command shows four more warnings for the emoji families that are never loaded.

The CLI template names it correctly (`templates/md-template.typ:40`, `font: "Libertinus Serif"`). Both front-ends therefore render in Libertinus Serif today, one on purpose and one by fallback: the moment Typst's default face changes, or a user's system supplies a real "Linux Libertine", the web output silently moves and the CLI output does not.

Change the three web themes to `"Libertinus Serif"`. `ieee.ts:12` carries a comment justifying "Linux Libertine" as a Times-metric stand-in; update it, the reasoning still holds for Libertinus.

> Revised 2026-08-18: emoji and per-theme custom fonts stay; the web build learns to load what a theme names, rather than themes being trimmed to what the build happens to have. Open-source faces are acceptable everywhere, which also unblocks §2.11.
>
> 1. Rename `"Linux Libertine"` → `"Libertinus Serif"` in `default.ts:13`, `minimal.ts:13`, `ieee.ts:26`.
> 2. Themes declare `fonts: { families: [...], assets: ["text"] | ["text","emoji"], urls: [...] }` instead of assuming what is loaded.
> 3. `typst-compiler.ts` builds `preloadRemoteFonts(urls, { assets })` from that descriptor and caches compiler instances by descriptor signature. typst.ts only loads fonts in the `beforeBuild` hook (no post-init font-add in the typings), so a changed font set means a new compiler instance.
> 4. Emoji stays and becomes real. Declared family chain: `("Noto Color Emoji", "Twitter Color Emoji")`. Ship **Noto Color Emoji** self-hosted (10.7 MB, **OFL-1.1**, from `googlefonts/noto-emoji`); keep Twemoji as the fallback family for systems that already have it (13.4 MB, CC-BY 4.0, the face `typst-dev-assets` pins). Both verified: zero `unknown font family` warnings, embedding as `NotoColorEmoji` / `TwitterColorEmojiSVGinOT` respectively. Self-host rather than CDN-pin, because `typst-dev-assets@v0.13.1/files/fonts/NotoColorEmoji.ttf` 404s, which is what makes emoji broken today. Load lazily on the first document containing an emoji codepoint: one compiler re-init instead of 10.7 MB on every page load.
>
>    Rejected: `samuelngs/apple-emoji-ttf`. Its MIT licence covers the build tooling, not the glyphs; the README states the assets belong to Apple and pushes the licensing risk onto the redistributor. No upside over Noto for a public site.
> 5. CLI keeps the system emoji families and adds `Twitter Color Emoji`, so both front-ends can resolve the same face; document `--font-path` for the CLI.
>
> Tests: no `"Linux Libertine"` left in `src/`; every family a theme names is in its declared font set; per-theme render asserts **zero** `unknown font family` warnings and the expected `pdffonts` list; an emoji fixture embeds `TwitterColorEmojiSVGinOT`; new visual fixture `web/test/visuals/fonts-and-emoji.md`.

### 2.5a typstmd: pin one Markdown dialect across both front-ends
✅ APPROVED 2026-08-18

**Files:** `web/src/pipeline.ts:36-42`, `web/src/remark-highlight.ts`, `web/src/mdast-to-typst.ts:212-221`

Three behaviours exist in the web front-end only and have no Typst or CommonMark basis:

| Feature | Where | Pandoc CLI | Cost of keeping |
|---|---|---|---|
| `==mark==` → `#highlight[]` | `remark-highlight.ts` | leaves it literal | web and CLI produce different documents from one file |
| `+++` → `#pagebreak()` | `mdast-to-typst.ts:212-221` + `cmd/filters/pagebreak.lua` | same behaviour, via the Lua filter | consistent across front-ends; only a dialect question |
| `:rocket:` → 🚀 | `remark-emoji` in `pipeline.ts:41` | not applied | renders as tofu in the browser: no emoji font is loaded |

The emoji one is the sharpest: the shortcode always converts, and the glyph then has no font. `assets: ["emoji"]` would pull `TwitterColorEmoji.ttf` (**13.4 MB**, verified `content-length`) and `NotoColorEmoji.ttf`, which **404s** at `typst-dev-assets@v0.13.1` (verified). So today emoji output is guaranteed broken, and fixing it costs 13 MB per page load.

> Revised 2026-08-18: nothing gets dropped. One dialect, implemented identically on both sides, is the goal. Emoji is settled in §2.4; the table divergence found while verifying this is split out as §2.5b.
>
> - `==mark==` is not a typstmd invention: `pandoc -f markdown+mark -t typst` emits `#highlight[important]`, byte-identical to the web output. Verified.
> - `~sub~` / `^super^` already agree once §2.2 lands (Pandoc has both on by default).
> - `+++` is typstmd's only invented syntax, and the two implementations already agree on the rule: `cmd/filters/pagebreak.lua` fires on a paragraph that is exactly one `Str` of `+++`; `mdast-to-typst.ts:212-221` fires on a paragraph with one text child trimming to `+++`. Keep it, document it as the single extension, pin it with a parity case.
>
> Edit: replace the CLI's reliance on Pandoc's kitchen-sink `markdown` defaults (which silently grants definition lists, fenced divs, citations, grid tables, bracketed spans and ~40 more the web has never had) with an explicit list mirroring the web plugin set: `markdown_strict+pipe_tables+strikeout+task_lists+footnotes+yaml_metadata_block+mark+subscript+superscript+emoji+autolink_bare_uris+backtick_code_blocks+fenced_code_blocks+fenced_code_attributes`, in `cmd/converter.sh:58`.
>
> **`smart` stays on.** Verified that `-smart` makes Pandoc escape typography (`a -- b, "q"` → `a -\- b, \"q\"`), so the CLI would render literal `--` and straight quotes while the web renders an en dash and curly quotes via Typst. With `smart` on, both emit `--` and `"` untouched and only `...` differs (`etc…` pre-converted by Pandoc vs `etc...` converted by Typst) — same rendered glyph, and the one pair the parity test normalises.
>
> Docs: one short "dialect" section in `CLAUDE.md` / `README.md` — `+++` is the only invented syntax; anything else must be expressible as `pandoc -f <pinned list>`.

### 2.5b typstmd: reconcile table emission between the front-ends
✅ APPROVED 2026-08-18

**Files:** `web/src/mdast-to-typst.ts` (`serializeTable`), `cmd/filters/auto-table-widths.lua`

The same pipe table produces two unrelated Typst structures. Verified:

```typst
// CLI (Pandoc typst writer)               // Web (serializeTable)
#figure(                                   #table(columns: (auto, 1fr), [a], [b], [1], [2])
  align(center)[#table(
    columns: 2, align: (auto,auto,),
    table.header([a], [b],),
    table.hline(), [1], [2],)]
  , kind: table)
```

Pandoc's shape is the more idiomatic Typst: `table.header` is real header semantics that repeat across page breaks, and `kind: table` makes the figure referenceable. The web's shape carries the per-column width heuristic (`WIDE_THRESHOLD` 40 / `NARROW_THRESHOLD` 12) that fixed real column-overflow bugs.

> Revised 2026-08-18: narrowed to the one defect that is real in Typst terms, keeping the existing table work intact.
>
> Measured in pure Typst (59-row table, 8cm page, `--ignore-system-fonts`): with `table.header([Key], [Description])` the header row renders on **all 7 pages**; with a plain first row it renders **once**, and pages 2-7 have no header. That is the defect: long tables silently lose their header.
>
> 1. `serializeTable` wraps the first row in `table.header(...)`. The `WIDE_THRESHOLD`/`NARROW_THRESHOLD` column heuristic, the zero-width-space wrapping rules and the themes' `show table.cell.where(y: 0)` styling are untouched.
> 2. `cmd/filters/auto-table-widths.lua` is extended to emit the identical shape, so both front-ends agree cell for cell.
> 3. **No `#figure` wrapper and no `align(center)`.** That is Pandoc convention, not Typst's: `#figure` exists for captions and references and centres its content. Our tables have neither, so a bare `#table` is the idiomatic form, and the CLI drops the wrapper.
>
> Tests: parity assertion (CLI output equals web output for a 2-column and a wide-column table); render assertion automating the 7-vs-1 header count; visual case in `web/test/visuals/tables.md`.

Tests: parity assertion on a 2-column and a wide-column table; render assertion that a table split across a page break repeats its header; visual case in `web/test/visuals/tables.md`.

### 2.6 typstmd: stop injecting placeholder prose into the document
✅ APPROVED 2026-08-18

**File:** `web/src/mdast-to-typst.ts:328-334` (html), `emitImage` (remote images)

An HTML block becomes the literal text `[HTML block removed]` in the PDF, and a remote image becomes `[Image: alt]`. Both are typstmd writing sentences into the user's document. The warning channel (`warnings.ts`) already exists and is surfaced in the UI; that is where this belongs.

> Revised 2026-08-18: worse than first written, inline HTML shares the code path. `para with <br> inline break and <em>tags</em>.` currently serialises as `para with \[HTML block removed\] inline break and \[HTML block removed\]tags\[HTML block removed\].` — the phrase printed three times inside one sentence, four warnings, nothing block-level involved.
>
> Decision: **keep the inner text, drop the tags.** `<em>tags</em>` renders as `tags`; no invented prose ever reaches the document. The pinned dialect from §2.5a already produces exactly `para with inline break and tags.` on the CLI, so both front-ends agree with no extra work. The same rule removes the `[Image: alt]` placeholder; §2.7 makes remote images render for real.
>
> The warning stays in `warnings.ts` and the UI. That is the channel for "typstmd could not represent this"; the PDF is not.
>
> Tests: no output may ever contain `HTML block removed` or `[Image:`; parity assertion against the CLI on the same input; render assertion that `pdftotext` yields `para with inline break and tags.`; visual case in `web/test/visuals/html-and-images.md`.

Affects `web/test/pipeline.test.ts` expectations that assert the placeholder strings.

### 2.7 typstmd: make local and remote images work in the browser
✅ APPROVED 2026-08-20

**File:** `web/src/typst-compiler.ts`, `web/src/mdast-to-typst.ts` (`emitImage`)

The compiler only ever populates one virtual file (`inner.addSource("/main.typ", source)`), so `#figure(image("photo.png"))` fails with `error: file not found (searched at …/photo.png)`. Verified.

typst.ts exposes `mapShadow(path: string, content: Uint8Array)` (`node_modules/@myriaddreamin/typst.ts/dist/esm/compiler.d.mts:175`), so the web build can inject binary assets into the VFS. Two options, in order of effort:

1. Fetch `https?://` images at compile time and `mapShadow` them under a stable path, so remote images render instead of becoming a placeholder. Local relative paths still cannot work in a browser with no file access; emit a warning instead of a doomed `image()` call.
2. Add a file-drop in the UI that maps user-supplied assets into the VFS.

> Revised 2026-08-20: both options approved, and one honest limit added.
>
> 1. Remote images are fetched in the same async prefetch pass §2.14 introduces for packages, mapped into the VFS with `mapShadow(path, Uint8Array)` (`compiler.d.mts:175`), and emitted as `image("<mapped path>")`. One mechanism, two consumers.
> 2. A **UI file-drop** maps user-supplied assets into the VFS under the paths their Markdown references, so `![local](p.png)` works in the browser once the file is dropped in.
> 3. With neither available, emit nothing and raise a warning naming the path. §2.6 forbids inventing prose in the document, and after §2.6 the old `[Image: alt]` placeholder is gone, so this is the branch that keeps a missing image from vanishing silently.
>
> **CORS is a real limit on remote images, spot-checked:** `raw.githubusercontent.com` and `noel.engineer` both serve `access-control-allow-origin: *`, while `www.python.org` serves none, so its images cannot be fetched by a browser at all. Arbitrary image URLs will therefore fail through no fault of typstmd; the warning must say so specifically ("host does not allow cross-origin reads"), and the file-drop is the workaround. This is also why the CLI and the browser cannot be identical here: a browser has no filesystem and is bound by CORS, so `![local](p.png)` resolving against the working directory on the CLI is the single documented exception to the §2.5 one-way invariant.
>
> Tests: coded assertion that a remote image emits `image("<mapped path>")` and an unresolvable one emits nothing plus a warning; render assertion that the remote-image fixture produces a PDF carrying an image XObject; a dropped-file case asserting the VFS path is honoured; the intentional CLI/browser difference documented in the parity test itself; visual case in `web/test/visuals/html-and-images.md`.

### 2.8 typstmd: add a CLI-vs-web parity test
✅ APPROVED 2026-08-20

**File:** `web/test/parity.test.ts` (new), fixtures under `web/test/fixtures/parity/`

Everything above is a regression waiting to happen because nothing compares the two front-ends. Add a small curated corpus (the evidence table's rows) and assert that `markdownToTypst()`'s body and `pandoc -f markdown -t typst`'s output agree after whitespace normalisation, skipping the constructs deliberately allowed to differ (documented in the test).

Three layers, all using tooling proven during this review:

1. **Parity** (`web/test/parity.test.ts`) — one corpus, both front-ends, equality after whitespace normalisation. Documented exceptions only: `etc...` vs `etc…` (§2.5a) and local image paths (§2.7, a browser has no filesystem). Anything else that differs is a failure.
2. **Render** (`web/test/render.test.ts`) — compile with `typst compile --ignore-system-fonts` so the font set equals the browser's, then assert on `pdftotext` (text that must survive), `pdffonts` (faces embedded, and **zero** `unknown font family` warnings), `pdfinfo` (page count, page size). This is the layer that catches vanished tildes, swallowed clauses, lost table headers and wrong fonts, none of which a string assertion can see.
3. **Visual fixtures** — new `web/test/visuals/{fonts-and-emoji,html-and-images,inline-marks}.md`, plus new cases in the existing `headings.md` and `tables.md`. Eyeballed via `bun run dev`, workflow unchanged.

> Revised 2026-08-20: **CI installs the tooling** rather than skipping. `.github/workflows/pages.yml` currently runs `bun install --frozen-lockfile`, `bun test`, `bun run build` on `ubuntu-latest` with no `pandoc`, `typst` or poppler, so a skip-if-absent harness would protect nothing on push. Add pinned installs of `typst`, `pandoc` and poppler-utils to that job (pinned, because a render assertion is only reproducible against a known compiler version, and Typst's default font can change between releases, which is exactly the §2.4 fragility). Local runs keep the skip-if-absent behaviour from `compile-smoke.test.ts`.

Dependency note, and the reason this lands last on the typstmd side: the corpus must be written against post-fix behaviour or it codifies the bugs. Each earlier change contributes its own cases as it lands; this change is the harness plus the sweep confirming the whole corpus agrees.

### 2.9 website: stop the CV template drawing a header the Markdown also carries
✅ APPROVED 2026-08-20

**File:** `resume/template/cv-typstmd.typ` (the `conf` header block)

Reproduced exactly: a Markdown that opens with `# Noël Ruault`, a role line, and contact links renders the template's own header *and* the Markdown's, with `# Noël Ruault` styled as a section label (`— NOËL RUAULT`). That is the screenshot.

> Revised 2026-08-20: sniffing the leading Markdown block is rejected. It would be a typstmd-only convention no other Typst template shares, and §2.13 makes that unnecessary. Identity goes where every Universe template puts it: in the `.with(...)` call.
>
> **Step 1, works with today's template and is a one-line fix:** delete the identity block from `resume/template/cv.md` so the file starts at `## Profile`. The template already draws name, role and contacts from its own parameters, so the duplication disappears immediately.
>
> **Step 2, the proper shape:** `cv-typstmd.typ` exposes `#let cv(name:, role:, contacts:, theme:, body)` and the preamble calls
>
> ```typst
> #show: cv.with(name: "Noël Ruault", role: "Site Reliability & DevOps Engineer", contacts: (…), theme: "aitelier")
> ```
>
> matching `basic-resume`'s `author:`/`location:`/`email:` and `graceful-genetics`'s `authors: (dicts)`. Identity becomes data passed in exactly once, and the file turns into a normal Typst template that compiles in any Typst editor, not only inside typstmd. `conf` survives as a thin alias because §2.13 keeps that path for saved templates; `title:` frontmatter still reaches the PDF via `#set document(title:)`.
>
> Newcomer ergonomics, since a bare `.with(...)` preamble is opaque to someone who does not know Typst: the Template view ships this preamble pre-filled, so the fields are visible and editable rather than something you have to know to write.

### 2.10 website: style entries positionally so the Markdown stays plain
✅ APPROVED 2026-08-20

**File:** `resume/template/cv-typstmd.typ` (the `heading.where(level: 3)` show rule)

Current contract is ``### Title `2025 – Present` `` plus an inline-code org line. A CV written as `### Title · WebBeds, Remote (ES) · 2025–Present` therefore renders as one bold line, with no right-aligned date and no muted org line, which is the other half of the screenshot.

> Revised 2026-08-20: parsing heading prose is rejected in favour of positional styling, so the Markdown carries no convention at all. Typst templates take structured arguments (`#work(title:, company:, dates:)`) and Markdown cannot call a function, so the closest faithful translation is to let the template style by position.
>
> Authoring form, with nothing to escape or remember:
>
> ```markdown
> ### Site Reliability & DevOps Engineer
>
> WebBeds · Remote, ES · 2025 – Present
>
> Reliability, delivery, and cost for a global B2B travel-booking platform.
>
> - Operate GitOps delivery across the EKS clusters.
> ```
>
> Template, ~20 lines of plain Typst: the h3 rule resets `state("since-heading")` to 0 and renders the title; a `show par` rule reads the counter so paragraph 0 is the mono muted meta line, paragraph 1 the italic summary, the rest body text.
>
> Verified, not assumed:
>
> | Check | Result |
> |---|---|
> | positional styling | works, zero warnings, counter resets per entry |
> | loose list right after a heading | **misfires**, first two bullets styled as meta line and summary. Fixed by `show list`/`show enum` resetting the counter to 99. Tight lists, blockquotes and tables are unaffected either way |
> | right-aligning the date | emitting `grid`/`block` from inside `show par` fails with `error: maximum show rule depth exceeded`; inline `h(1fr)` works, org left and date right |
> | meta line with no ` · ` | whole line renders as the org, no phantom date |
>
> Accepted limits: the date sits on the meta row rather than the title row (~4mm lower than the reference PDF) because a heading rule cannot see the paragraph after it, Typst having no sibling selector; and a meta line containing markup is not a single text run, so it renders muted mono without the right-aligned split instead of breaking.
>
> `cv.md` is rewritten to this form, which also removes the last inline-code convention from it.

### 2.11 website: close the remaining gaps between `cv-typstmd.typ` and `cv-typst.typ`
✅ APPROVED 2026-08-20

**Files:** `resume/template/cv-typstmd.typ`, `resume/template/cv-typst.typ`, `resume/template/cv.md`

Verified deltas that remain after §2.9–§2.10:

| Delta | Why | Fix |
|---|---|---|
| Fonts: `cv-typst.typ` uses Helvetica Neue / Optima / Iowan Old Style / Menlo | none of them exist in the WASM bundle; all four are proprietary macOS faces, so they cannot legally be shipped as web assets | to make the two match *exactly*, move both files to faces available in both worlds (Libertinus Serif + DejaVu Sans Mono are already there), or self-host open substitutes and preload them via `preloadRemoteFonts([...urls])`, which typst.ts supports. Until then the two renderings differ by typeface, by design |
| Skills block: official uses a 2-column `grid`, typstmd variant uses bullets | Markdown has no 2-column primitive, and a GFM table forces a visible header row | either accept bullets, or add a `show list.item` rule that right-pads a leading inline-code label into a fixed column. The rule is ~8 lines and gets the official look from plain Markdown |
| `~` in `cv.md` was replaced with `≈` | works around §2.1 | revert to `~` once §2.1 lands |

> Resolved 2026-08-20.
>
> **Fonts: Libertinus Serif + Libertinus Sans**, with DejaVu Sans Mono for the mono role, in *both* `.typ` files and both palettes. Licences checked at source, not from memory: Libertinus `OFL-1.1` (`alerque/libertinus`), and Serif plus DejaVu Sans Mono are already in the WASM bundle so only Sans is self-hosted. Menlo's role goes to DejaVu Sans Mono on its merits, Menlo being a Bitstream Vera/DejaVu derivative. Loaded through §2.4's font descriptor, so web and CLI render the same faces. Also checked and available if the pairing is ever revisited: Inter `OFL-1.1`, EB Garamond `OFL-1.1`, Liberation Sans `OFL-1.1` (GitHub reports `NOASSERTION`, the LICENSE file itself says SIL OFL 1.1).
>
> **Skills grid: a plain GFM table, no new Markdown dialect.** Definition lists were considered and rejected: onboarding `definition_lists` would add non-standard Markdown, and the rule is to respect Markdown standards and put the smarts in Typst. Verified path, matching the reference layout exactly:
>
> ```typst
> #set table(stroke: none, inset: (x: 0pt, y: 3pt))
> #show table.cell.where(y: 0): none
> #show table.cell.where(x: 0): it => text(font: mono, size: 8pt, fill: accent)[#upper(it)]
> ```
>
> Measured results: `#show table.header: none` does **not** hide the header row (it still renders); `#show table.cell.where(y: 0): none` removes it with **no phantom gap**, and wrapped descriptions align in the second column. GFM requires a header row, so `cv.md` carries a throwaway `| Area | Detail |` that documents the columns for anyone reading the raw Markdown and never renders.
>
> Also rejected, for the record: restyling Typst `terms` items keeps the labels but discards `hanging-indent`, so wrapped lines return to the left margin. A `terms.item` show rule rebuilt as a grid does work, but it still requires definition lists to author, so it dies with them.

### 2.12 website: fix the broken PDF reference
✅ APPROVED 2026-08-20

**Files:** `resume/index.html:184`, `resume/README.md:21`

`noel-ruault-cv-aitelier.pdf` was renamed to `noel-ruault-cv.pdf` (same 122074 bytes, same `xmp:CreateDate 2026-08-12T11:21:23+02:00`, verified). The page's theme map and the README's build command still point at the old name, so the aitelier "Download PDF" link 404s.

> Resolved 2026-08-20: **both suffixed.** Published files become `noel-ruault-cv-aitelier.pdf` and `noel-ruault-cv-dracula.pdf`, symmetrical, with `noel-ruault-cv.pdf` kept as a stable copy of the default theme so an existing link to that name keeps working. `resume/index.html:184` and `README.md:21` point at the suffixed names, and the build commands write all of them.
>
> Test per the contract: a link check over `resume/index.html` and `resume/README.md` asserting every referenced local file exists. Cheap, and it is exactly the check that would have caught this rename.

### 2.13 typstmd: make a raw Typst template work unchanged

✅ APPROVED 2026-08-19

**Files:** `web/src/pipeline.ts:59-62`, `web/src/frontmatter.ts:84-115`, `web/src/main.ts` (template view)

The template slot is not a Typst slot, it is a typstmd slot: the pipeline unconditionally appends `#show: doc => conf(...)`, so a template that does not define `conf` fails with `error: unknown variable: conf`. That is the single reason a document copied out of typst.app or Typst Universe cannot be pasted in.

Verified that the fix is nearly free: taking `resume/template/cv-typst.typ` (a complete standalone Typst document, preamble plus content) and the Markdown-derived body, with only the injected `conf` line removed, compiles clean at 4 pages. Nothing else about a raw template is incompatible, because a Typst template is a preamble of `set`/`show` rules and appending content after it is exactly how Typst works.

Edit: detect what the template offers, in this order.

1. Template defines `conf` → emit `#show: doc => conf(...)` as today. Existing themes and saved custom templates keep working.
2. Template contains an explicit body marker (proposed `#typstmd-body`) → substitute the serialised body there, so a raw template can choose where content lands.
3. Otherwise → append the body after the template and emit document metadata as plain Typst (`#set document(title: ...)`), which is what a preamble-style template expects.

Frontmatter that cannot be passed to a `conf` that does not exist becomes `#set document(...)` instead, so `title` / `author` still reach the PDF.

> Grounded 2026-08-19 in four Typst Universe packages (`basic-resume:0.2.9`, `charged-ieee:0.1.4`, `dashing-dept-news:0.1.1`, `graceful-genetics:0.2.0`, all downloaded and read). Every one of them uses the same contract, `#show: <fn>.with(...)` where the function name belongs to the package and the parameters are template-specific:
>
> ```typst
> #show: resume.with(author: …, accent-color: "#26428b", paper: "us-letter")
> #show: graceful-genetics.template.with(title: […], authors: (…))
> #show: ieee.with(…)
> #show: newsletter.with(…)
> ```
>
> typstmd's `#show: doc => conf(…, doc)` is a private dialect of that convention, and the Template view holds exactly what a Universe `template/main.typ` holds minus its content.
>
> **Verified end to end:** `basic-resume:0.2.9`'s preamble plus the unmodified `resume/template/cv.md` through the real pipeline (0 warnings) fails with `error: unknown variable: conf` at the injected line, and compiles to a clean 2-page A4 CV in basic-resume's typography the moment that one line is removed, with the package auto-resolved. One injected line is the whole barrier.
>
> Frontmatter cannot map onto arbitrary package parameters (`author: "string"` in basic-resume vs `authors: (dict, dict)` in graceful-genetics), so with no `conf` present it becomes `#set document(title:, author:)` and template-specific arguments stay in the user's own `.with(...)` call.
>
> Consequence worth noting: `cv-typstmd.typ` becomes optional rather than required, because the CV can then run on any Universe resume template.

Tests: paste-a-raw-template case for each of the three shapes; a regression that a theme template still routes through `conf`; render assertion that the raw-template output has the expected page count and document title; visual fixture using a real Typst Universe template.

### 2.14 typstmd: resolve `@preview` package imports in the browser

✅ APPROVED 2026-08-20

**File:** `web/src/typst-compiler.ts`

Plug-and-play from typst.app means Universe templates, and those start with `#import "@preview/<pkg>:<version>"`. The web build has no package registry wired, so every one of them fails to resolve.

typst.ts already ships the machinery: `FetchPackageRegistry` (`node_modules/@myriaddreamin/typst.ts/dist/esm/fs/package.mjs`) resolves a spec to `https://packages.typst.org/preview/{name}-{version}.tar.gz`, untars it into `/@memory/fetch/packages/preview/...` and caches it; it is installed through `withPackageRegistry(registry)` in the `beforeBuild` hooks, next to the existing `preloadRemoteFonts` call.

**Caveat, verified in the source:** `pullPackageData` uses a **synchronous** `XMLHttpRequest` (`request.open(..., false)`). On the main thread that blocks the UI and is disallowed in some contexts. Before adopting, check whether typstmd's compiler runs on the main thread or in a worker, and move it to a worker if it does not already run in one.

> Verified 2026-08-20 before designing: `packages.typst.org` serves `access-control-allow-origin: *` with `cache-control: public, max-age=7776000`, so browser fetching works and stays cached for 90 days. Download sizes are small: `basic-resume:0.2.9` 6.6 KB, `charged-ieee:0.1.4` 6.5 KB, `graceful-genetics:0.2.0` 24.5 KB, `dashing-dept-news:0.1.1` 125 KB (it ships a cover JPEG). Package assets travel inside the tarball, so a template's own images resolve once untarred; user images remain §2.7.
>
> There is **no Worker anywhere in `web/src`**, so the compiler runs on the main thread and the shipped registry's synchronous XHR would block the UI on every fetch.
>
> Revised: **support both strategies behind one interface** so the choice can be made on observed UX rather than prediction.
>
> ```ts
> interface PackageResolver {
>   prepare(source: string): Promise<void>   // no-op for the sync strategy
>   registry: TypstPackageRegistry           // what withPackageRegistry() receives
> }
> ```
>
> - `prefetch` (default): scan the source for `@preview/<name>:<version>`, `await fetch()` each spec, cache bytes in IndexedDB, resolve synchronously from memory. No main-thread network I/O, offline after first load, and the status line can name what it is fetching.
> - `sync-xhr`: thin wrapper over typst.ts's `FetchPackageRegistry`, unmodified. Fewer moving parts; blocks the main thread and rides a deprecated API.
>
> Selection lives beside the existing theme/template state (localStorage key plus a UI control), so switching is a click and a reload. A Worker-based strategy can slot in later without touching callers. The abstraction is justified by two implementations that are both wanted, and by `sync-xhr` being the fallback if prefetch misbehaves on a CSP-restricted host.
>
> Tests are parameterised over both strategies and must pass identically: compile a document importing `@preview/basic-resume:0.2.9` and assert 2 pages; assert the second compile makes zero network calls; assert `@preview/does-not-exist:1.0.0` produces an actionable error naming the spec; visual fixture rendering a Universe template.

### 2.15 typstmd: inline code inside a heading renders at body size

✅ APPROVED 2026-08-20

**Files:** `web/src/themes/default.ts`, `minimal.ts`, `academic.ts`, `ieee.ts` (heading show rules)

A heading containing inline code renders that code at ~9pt in code-green while the surrounding title is 22pt, so the title reads as broken text. Reproduced from plain Markdown at every heading level.

The themes already carry an attempted fix, `#show raw: set text(size: 1em)`, **6 occurrences each** in `default.ts`, `minimal.ts` and `academic.ts` (`ieee.ts` has none), and it is a **no-op**. Three candidates tested head to head in isolated Typst:

| Variant | Result |
|---|---|
| A `show raw: set text(size: 1em)` (current) | code stays 9pt green: `1em` resolves against the 9pt the global `show raw` rule already set, so it changes nothing, and `fill` is never reset |
| B `show raw: set text(size: 22pt, fill: …)` | works, but restates each heading's size, so the two drift |
| C `show raw: it => text(size: 1em, fill: …, it)` | **works**: the wrapping form evaluates `1em` against the enclosing heading context rather than the raw element's own size |

Edit: replace the no-op with C in every heading rule across the three themes and add it to `ieee.ts`. **Code keeps the theme's green fill** — only the size is corrected, so inline code in a title stays visually identifiable as code. Block code rules are untouched.

Tests: coded assertion that no theme contains `show raw: set text(size: 1em)`; render assertion that code and prose glyph heights inside one heading match within tolerance; visual case in `web/test/visuals/headings.md` using a real-world title that mixes code spans, a slash, an em dash, underscores and a `file.go:55-68` reference in one line.

### 2.16 typstmd: expose all frontmatter to the template as one Typst dict

✅ APPROVED 2026-08-20

**Files:** `web/src/frontmatter.ts`, `web/src/pipeline.ts`

The web front-end honours five frontmatter keys (`title`, `author`, `date`, `lang`, `toc`). Everything else a document declares is dropped, so a Markdown file cannot carry a subtitle, an abstract, keywords, a logo path or a copyright line to its template.

Emit every key as one Typst dictionary **before** the template, so the template opts in and a raw Universe template ignores it:

```typst
#let frontmatter = (
  title: [DevSecOps],
  subtitle: none,
  date: [2023/2024],
  author: ([Noël Ruault],),
  keywords: ([Ciberseguridad], [DevSecOps]),
  mainfont: "UIBsans",
  colorlinks: true,
  titlepage-logo: "./assets/logos/logo-long-black.png",
)
```

**The contract is one sentence: typstmd passes values through, templates decide what they mean.** typstmd must never act on `mainfont`, `colorlinks` or any other styling-shaped key. The moment it does, it is a style engine again, which is the thing this plan exists to remove. A template reads `frontmatter.at("subtitle", default: none)`.

Cheap to support because it reuses the strict value encoder already in `frontmatter.ts` rather than interpolating raw YAML, and adds no Markdown or Typst syntax: YAML frontmatter already parses, and a `#let` dict is ordinary Typst. Composition note: local paths such as `titlepage-logo` need §2.7's file-drop in the browser.

Tests: coded assertion that arbitrary keys survive into the dict with correct Typst types (string, content, boolean, array); assertion that no styling key changes the output on its own; render assertion using a template that consumes `subtitle` and `keywords`; visual fixture with a full academic-style header.

### Considered and rejected: dropping Pandoc

The CLI shells out to Pandoc while the web has a self-contained `remark` + `mdast-to-typst.ts` converter, so the CLI could run that same converter and Pandoc could be deleted (verified feasible: `bun build --compile` ships a standalone executable, and `@mermaid-js/mermaid-cli` v11.16.0 provides `mmdc` directly, `mermaid-filter` being only its Pandoc wrapper).

**Rejected 2026-08-20:** Pandoc works and nothing better is proven. The concern it was meant to address was narrower, namely not onboarding non-standard Markdown extensions such as `definition_lists`; that is handled by §2.11 instead. `templates/md-template.typ` and the Lua filters stay.

### 2.18 typstmd: performance gate, because compile time is the product

✅ APPROVED 2026-08-20

**Files:** `web/test/bench.ts` (extend), `web/src/typst-compiler.ts` (already emits the marks)

`test/bench.ts` measures the JS transform and heap growth over 200 iterations. It never times the Typst compile, which is the dominant cost, so the benchmark can stay flat while the app gets twice as slow.

Measured during the walkthrough, native typst, best of three, to establish that the one risky change is linear rather than quadratic:

| entries | pages | plain styling | positional `state` rule (§2.10) | ratio |
|---|---|---|---|---|
| 150 | 15 | 0.05s | 0.10s | 2.0x |
| 300 | 30 | 0.09s | 0.25s | 2.8x |
| 600 | 60 | 0.21s | 0.38s | 1.8x |

Linear, a constant ~2x multiplier on compile. Acceptable only because §2.10 lives in `cv-typstmd.typ` and a CV is two pages.

Gate to add:

1. Extend the bench to time **end-to-end compile** per theme and per fixture, not just the transform, and to read the existing `performance.mark`s (`wasm-fetch`, `compiler-init (wasm+fonts)`) so init cost is tracked separately from compile cost.
2. Record baselines and fail on regression: compile time +10%, compiler init +0% (init is paid on every page load).
3. **No new per-element show rule in `themes/*.ts` without a bench number.** `state` and `context` force Typst's introspection loop; a rule that reads state per paragraph costs ~2x. The §2.10 positional rule must never migrate from the CV template into a core theme.
4. Prefetch work (§2.14 packages, §2.7 images) is memoized per spec and per URL. Auto-compile fires on typing, so an unmemoized prefetch re-scans and re-fetches on every keystroke.
5. The emoji font (§2.4, 10.7 MB plus a compiler re-init) loads at most once per session and only for a document containing an emoji codepoint. Never on init for everyone.

Pre-existing cost worth measuring while the harness is being built, though out of scope to change here: the themes run `show regex(",")` and `show regex("[-_./:]")` over raw text, which is a per-character show rule on every code span and block. In code-heavy documents that is likely the single largest per-compile cost in the current themes.

## 3. Order of landing

Walkthrough completed 2026-08-20: 17 changes approved, none skipped. Order below reflects the dependencies the review uncovered, not the original numbering.

1. `git switch -c typst-pairing` off `main` (11d462a). The 7 pre-existing modified files stay out of this work.
2. **§2.1 + §2.2** — the two that produce the visible CV corruption, both small.
3. **§2.15** — inline code in headings; small, visible, independent of everything else.
4. **§2.3, §2.6, §2.5b** — mechanical emission changes, each with its fixture regeneration.
5. **§2.4** — font descriptor and the `Libertinus Serif` rename. Must precede §2.11, which depends on the descriptor to load Libertinus Sans.
6. **§2.5a** — pin the CLI dialect. Still valid: Pandoc stays.
7. **§2.16** then **§2.13** — the frontmatter dict is how a template without `conf` receives metadata, so it lands first or together.
8. **§2.14** — package resolution, after §2.13, since plug-and-play needs both.
9. **§2.7** — images, after §2.14; they share the async prefetch pass.
10. **§2.18** — the performance gate, built before §2.8's corpus so every later change lands with a compile-time number, and so the baselines are recorded against pre-change behaviour.
11. **§2.8** — the correctness harness, written against post-fix behaviour, plus the CI tooling installs.
12. Website: **§2.9 → §2.10 → §2.11 → §2.12**, verified by re-rendering `cv.md` and diffing against `resume/noel-ruault-cv.pdf`.

Gate for every step: `bun test` stays at 139+ pass / 0 fail, and no step regresses compile time beyond §2.18's budget, and the render assertions from §2.8 pass once that harness exists.

## 4. Risk surface

- **Fixture churn.** §2.3, §2.5b and §2.6 change emitted strings, so `web/test/fixtures/*.typ` and parts of `pipeline.test.ts` need regenerating. Regenerating blindly hides regressions; diff each one by eye.
- **`remark` is less battle-tested than Pandoc's reader** on strange Markdown. Pandoc stays, so this only bites the web front-end, and §2.8's corpus is the mitigation.
- **`~` escaping changes existing documents.** A document relying on a bare `~` as a non-breaking space starts showing a tilde. Undocumented behaviour, no fixture depends on it.
- **Emoji costs 10.7 MB** and the lazy-load path re-inits the compiler. Unverified in a real browser: whether `loadFonts` tolerates a partially failed fetch. Check before shipping the lazy path.
- **Package resolution on a CSP-restricted host.** `prefetch` uses `fetch`, `sync-xhr` uses XHR; a strict host may block either. That is why both strategies exist.
- **Typst's default face is load-bearing today.** §2.4 removes that dependency, but until it lands, a Typst release that changes the default silently changes every web render.
- **`resume/` lives in the deploy output repo.** The `website` checkout is the gh-pages branch and `resume/` is untracked there; the next Hugo deploy force-push wipes it. Still unresolved, see below.

## 5. Open questions

- **Where does the website work land?** `resume/` is untracked on the `website` gh-pages checkout and will be wiped by the next deploy. Moving it into `webpage/static/resume/` (the Hugo source) is the durable fix. This is the one decision still blocking §2.9-§2.12 being committed anywhere.
- **Do the CI installs get pinned versions?** §2.8 argues yes, because a render assertion is only reproducible against a known `typst`, and Typst's default font can change between releases. Pinning means a manual bump when Typst updates.
- **Emoji lazy-load behaviour in a browser** (from §2.4): confirm a failed or partial font fetch does not reject compiler init, before relying on it.
- **Plan location.** This file sits at `.plans/2026-08-18/typst-parity.md`, while the repo's other plans use numbered directories (`1-…` through `7-…`). Say the word and it moves to `.plans/8-typst-parity/plan.md`.

### Decisions taken during the walkthrough

- **Typst is the reference, Pandoc is the CLI's converter and only a cross-check.** Where Pandoc's habits are not Typst's, Typst wins.
- **Respect Markdown standards; put the smarts in Typst.** No new non-standard Markdown: `definition_lists` was rejected, and the skills grid is built from a plain GFM table instead.
- **Keep every existing feature.** Emoji, per-theme custom fonts, `==mark==`, `+++` all stay; nothing was dropped to make parity easier.
- **Pandoc stays.** Replacing it with the web converter was proposed, verified feasible, and rejected: it works, and nothing better is proven.
- **A raw Typst template must work unchanged**, which is what §2.13 and §2.14 exist for.
- **Every change ships coded, render and visual tests**, and CI installs the tooling to run them.
