# AGENTS.md

Context for AI agents (Claude Code, Codex, Cursor, OpenCode, …) working on or with typstmd.

## What typstmd is

Typstmd converts Markdown to PDF through two front-ends that share one design contract:

- **Web** (`web/`, hosted at https://noelruault.github.io/typstmd/): Markdown → remark (MDAST) → Typst string → Typst WASM compiler → PDF. Runs 100% in the browser; the document never leaves the machine.
- **CLI** (`cmd/`): Markdown → Pandoc → Typst → PDF. Shell-driven.

Both emit **standard, idiomatic, self-contained Typst**: every line of generated output must compile in the upstream `typst` compiler (0.14+) with no custom macros, no hidden context, and no Markdown syntax leaking into the Typst.

## Authoring a template (the common task)

A template is a single Typst `.typ` file that styles the document. The web app loads one via the **Open .typ** button or by dropping the file onto the page. typstmd generates the document **body** from the user's Markdown, then composes it with the template one of three ways, auto-detected in `web/src/pipeline.ts` (`assemble`):

1. **`conf()` convention** — if the file defines `#let conf(title: none, authors: (), date: none, lang: "en", toc: false, doc) = { … doc }`, typstmd calls `#show: doc => conf(doc)` and passes the frontmatter (title/author/date/toc). Use this for a full-document template. It is the Typst Universe / typst.app convention, so a starter's own `template/main.typ` works unmodified.
2. **Body marker** — put `#typstmd-body` where the body should land; typstmd substitutes it with the serialized body.
3. **Raw preamble** — anything else: typstmd appends the body after the file and passes title/author/date via `#set document(...)`.

Rules templates must follow:

- Name only fonts the build can resolve. The browser build ships Libertinus Serif plus a small set; naming an unavailable family makes every compile warn. When unsure, do not set a font family.
- Size inline code relative to context (`0.78em`), never an absolute `pt`, or code inside a heading renders at body size.
- Keep it to one `.typ` file.

A built-in theme (for repo contributors) is different: `web/src/themes/<id>.ts` exporting a `Theme`, registered in `themes/index.ts`. Only a theme carries a font descriptor. See `CLAUDE.md` for theme spacing invariants and the registration steps.

## Typst rules that bite (each one cost a wrong attempt)

- Name only fonts the build resolves, and use **static faces**: Typst warns for every family it cannot resolve (whether or not the document uses it), and silently drops bold for variable fonts.
- Size inline code relative to context (`0.78em`), never a `pt`; `show raw: set text(size: 1em)` is a no-op because `1em` resolves against the size the outer rule already set.
- A `set` rule inside an element's own `show` rule cannot restyle that element (e.g. `set table.cell(fill: …)` from a table show rule makes the header row vanish); set fills and strokes before the element is realised.
- `box(width: 100%)` (or `height: 100%`) inside a table cell is a circular size dependency that collapses the column or blows up the row.
- Re-emitting the same element type from its own show rule recurses ("maximum show rule depth exceeded"); hand back a different construct.
- `array.join("")` returns `none` for an empty array, and an empty table cell is exactly that; guard it.
- `table.header(…)` is what repeats the header row when a table spans pages; without it page 2 loses the header.
- Everything is standalone Typst for the upstream compiler (0.14+, which merman needs): no custom macros, no reliance on typstmd internals, no Markdown in the output.

The full, measured set (theme vertical rhythm, WCAG leading values, the pentest-theme traps) is in `CLAUDE.md`.

## Where to read more

- `CLAUDE.md`: full pipeline architecture, theme spacing rules, test layers, and the strict Markdown/Typst separation guideline.
- `web/llms.txt`: LLM-facing site summary.
- `README.md`: CLI prerequisites and usage.

## Known limitations

Check GitHub Issues labeled `improvement`:

```bash
gh issue list --label improvement
```

When asked to improve this project, check these issues first and attempt any that are unblocked.
