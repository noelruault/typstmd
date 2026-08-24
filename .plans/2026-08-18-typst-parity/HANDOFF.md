# Handoff: typst parity work

Companion to `plan.md` (the typst-parity plan, `status: executed`). Everything below is committed and local; **nothing is pushed**.

## Where the work is

| Repo | Branch | Head | Base |
| --- | --- | --- | --- |
| `noelruault/typstmd` | `feature/typst-parity` | `c8af52b` | `main` @ `11d462a` |
| `noelruault/website` | `feature/typst-parity` | `7da28cb` | `gh-pages` |

typstmd, oldest first:

```
8ab96f0 carry over the in-progress IEEE theme, heading spacing and CLI template work
b840420 time the actual compile, not just the transform
99b4ad6 stop the converter mangling prose: tildes, subscripts, heading levels, HTML
568a237 make code scale with its context and load only the fonts a document needs
2fc4a5f make both front-ends emit one table shape, and pin the CLI's dialect
fb31201 let a raw Typst template work, and pass every frontmatter key to it
c20422c resolve packages and images in the browser instead of failing on them
384cf93 compare the two front-ends on every commit, and install the tools to do it
81ac927 stop the perf gate flagging its own measurement noise
9e0870f record the parity plan as executed on feature/typst-parity
b4a4629 add the aitelier theme and one-click Universe starters
4b8771b accept any .typ file as the template, and keep the ones you bring
4368c12 one template picker instead of two dropdowns
9f5b004 let inline code in a table cell wrap in any template, not just ours
5650315 add a pentest report theme modelled on a generated report
c8af52b pin mermaid parity: both front-ends print the block, neither invents a diagram
```

`8ab96f0` is **your** uncommitted Jul-24 work (IEEE theme, heading spacing, CLI template), committed first so it could not be lost. It is not part of the plan.

website: `95427e2` commits `resume/` (it was untracked on gh-pages), `7da28cb` reworks the CV templates.

## State

```bash
cd typstmd/web
bun test          # 267 pass, 0 fail
bunx tsc --noEmit # clean
bun run build     # clean
bun run bench     # perf gate, exit 0
TYPSTMD_NETWORK_TESTS=1 bun test   # + Universe starter compiles and URL-declared fonts
cd .. && ./cmd/converter.sh example.md   # 8-page PDF

cd website/resume && ./check-links.sh && bun run build
```

## Decisions waiting on you

1. **Mermaid parity.** The only remaining front-end divergence: CLI `--mermaid` draws a PNG, the web prints the source. Three ways out, all costed:
   - bundle mermaid in the web via dynamic import (**3.49 MB** measured, loaded only for documents containing a mermaid block, like the emoji font). Both draw. The `.typ` stops being self-contained: the PDF carries an SVG and upstream `typst` needs that file alongside.
   - drop `--mermaid`. Both always print. Absolute parity, loses a working CLI feature.
   - render supported diagram types **as Typst content** (cetz for graphs, rects for bars). Both draw, `.typ` stays self-contained, no 3.5 MB dependency, but only implemented diagram types work.
   These conflict with the "runs in the original engine" rule you set, which is why it is your call.
2. **Always emit the frontmatter dict**, even when empty. One line in `pipeline.ts`, changes emitted output for every template, so parity fixtures move. Without it a template cannot safely read `frontmatter` (Typst has no "is this defined" test), which is why the `pentest` theme takes `subtitle` / `brand` / `classification` as template parameters instead of reading them from the document.
3. **Charts for the pentest theme.** Reference has severity-distribution and risk-type bars. A bar chart is ~20 lines of plain Typst using `layout()` and `rect` (prototyped, works); cetz is 126 KB and only earns its place for axes and scatter. Needs a data convention, e.g. a 2-column table whose second column is numeric.
4. **`resume/` still lives in the deploy output repo.** It is committed on a branch now, so it survives, but `gh-pages` is force-pushed by the Hugo deploy. The durable home is `webpage/static/resume/`. Unresolved since the plan was written.
5. **Two pentest-theme fidelity gaps**, both deliberate: all `#` headings are regular weight (the reference sets finding titles bold and section titles regular; Markdown cannot distinguish, a heuristic on "starts with Finding" is possible), and the metadata card shows row hairlines the reference lacks (one global `set table(stroke:)` serves both table kinds and the stroke function only sees coordinates).
6. **Push, and this plan's location.** Nothing is pushed. ~~This file sits in a dated `.plans/2026-08-18/` directory while the repo's other plans use numbered ones (`1-…` through `7-…`).~~ Resolved 2026-08-24: every plan now lives in its own `.plans/YYYY-MM-DD-<slug>/plan.md` bundle, dated by frontmatter `created` or first git commit. Push still pending.

## Typst facts learned the hard way

Each of these cost a wrong attempt; all are verified.

- A `set` rule **inside an element's own show rule cannot restyle that element**. Table fill and strokes must be set before any table is realised. `set table.cell(fill:)` from a show rule makes the header row vanish.
- `box(width: 100%)` inside a table cell creates a circular width dependency and collapses the column.
- Re-emitting the same element type from its show rule recurses: a `grid` inside `show par` aborts with "maximum show rule depth exceeded"; a bare content block re-enters the rule once and silently re-splits already-composed content.
- `array.join("")` returns **`none`** for an empty array, and an empty table cell is exactly that.
- `show raw: set text(size: 1em)` is a **no-op**: `1em` resolves against the size the outer rule already set. Size code relative to context (`0.75em`) instead.
- **Variable fonts are unsupported** ("may render incorrectly") and bold silently falls back. Use static faces.
- Typst warns for **every** font family it cannot resolve, used or not, so a theme must name only what it declares.
- `state` + `context` read-and-write in a `show par` rule triggers "layout did not converge within 5 attempts" and measured **2× slower**. Detect by content shape instead.
- **HTML export drops all drawn content.** A bar chart that renders in PDF gives `<body></body>` under `--format html`.
- `table.header` is what makes a header repeat across pages: measured 7 header rows vs 1 on a page-spanning table.

## Harness notes

- `web/test/render.test.ts` asserts on the compiled PDF via poppler (`pdftotext`, `pdffonts`, `-bbox` for geometry). It fetches a theme's declared font URLs when `TYPSTMD_NETWORK_TESTS=1`, otherwise skips that theme's zero-warning check.
- `web/test/parity.test.ts` compares both front-ends over 18 cases. Sanctioned divergences are asserted, not ignored: `etc…` vs `etc...`, the browser-only emoji show rule, and local image paths.
- `bun run bench` gates compile time against `web/test/perf-baseline.json`; best-of-7, 1.20× budget, only cases above 40 ms compile / 5 ms transform are judged, because below that the number is typst's process startup.
- CI installs pinned `typst 0.14.2`, `pandoc 3.9` and poppler. Pinned deliberately: render assertions need a known compiler, and Typst's default font has changed between releases.
- Mermaid cannot be unit-tested in the browser path (it needs a DOM); use Playwright for that, as was done for packages, images and the template picker.
