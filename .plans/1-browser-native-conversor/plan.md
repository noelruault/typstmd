# Plan: Browser-Native Markdown→PDF (feature/web)

## Goal

Build a fully client-side web app that converts Markdown to PDF in the browser. No server, no Pandoc. The target is **not** "replace Pandoc for all markdown" — it is "support a declared CommonMark + GFM subset, equivalent to what `example.md` exercises, and expand deliberately."

## Compatibility target

**Supported syntax (CommonMark + GFM subset):**

| Node type | Status | Notes |
|---|---|---|
| Headings (1-3) | Supported (normalized) | Levels 4-6 are normalized to level 3 — this is a lossy transform |
| Paragraphs | Supported | |
| Strong / emphasis | Supported | |
| Inline code | Supported | |
| Fenced code blocks | Supported | With language annotation |
| Links | Supported | |
| Block quotes | Supported | Including nested |
| Unordered lists | Supported | Including nested |
| Ordered lists | Supported | Including nested |
| GFM tables | Supported | Simple column layout only |
| Footnotes | Supported | Block content; repeated references via labeled Typst footnotes |
| Thematic breaks | Supported | |
| Soft/hard line breaks | Supported | CommonMark semantics: soft breaks → spaces, hard breaks → `\`. NOT GitHub-style newline-as-break (see Section 9). |
| Images | Deferred | Complex browser constraints (CORS, async fetch, blob lifetimes) — own subsystem later |
| Strikethrough | Deferred | Trivial to add but not in current template |
| Task lists | Deferred | |
| Autolink literals | Deferred | |
| HTML blocks/inline | Unsupported | Stripped with warning |
| Definition lists | Unsupported | Not in GFM |
| Raw attributes / captions | Unsupported | |

**Unsupported-node policy:** Any node not in the "Supported" list emits a warning in the UI status bar and renders a contextual placeholder in the PDF. No silent data loss. Placeholders should be descriptive, not just the node type:
- `image` → `[Image: <alt text or URL>]`
- `html` → `[HTML block removed]`
- Generic fallback → `[⚠ unsupported: <nodeType>]`

*Future consideration: a "strict export" mode that fails the compile with a warning list instead of embedding placeholders, for producing presentation-clean PDFs.*

## Architecture

```
Markdown string
  → unified + remark-parse + remark-frontmatter + remark-gfm  (parse to MDAST)
  → frontmatter extraction  (YAML → typed TS object → Typst value encoder)
  → mdast-to-typst transform  (MDAST tree → Typst markup string)
  → template assembly  (template + metadata bindings + body)
  → @myriaddreamin/typst.ts WASM compiler  (Typst source → PDF bytes)
  → browser display  (iframe + download link)
```

## Project structure

```
web/
  index.html
  src/
    main.ts                 -- Bootstrap, UI events, pipeline orchestration
    pipeline.ts             -- unified pipeline: parse → extract → transform → assemble
    mdast-to-typst.ts       -- MDAST tree → Typst markup (core serializer)
    typst-escape.ts         -- First-class escaping module (context-aware)
    typst-compiler.ts       -- Wrapper around typst.ts WASM, pinned API surface
    template.ts             -- Pure Typst template string (ported from md-template.typ)
    frontmatter.ts          -- YAML → typed metadata object → strict Typst value encoder
    warnings.ts             -- Warning collector for unsupported nodes / issues
  test/
    fixtures/               -- Markdown input → expected Typst output pairs
    mdast-to-typst.test.ts  -- Snapshot tests for the transformer
    typst-escape.test.ts    -- Edge-case tests for escaping
    frontmatter.test.ts     -- Metadata encoding tests
  package.json
  vite.config.ts
  tsconfig.json
  vitest.config.ts
```

## Dependencies

**Runtime (pin exact versions):**
- `unified` — pipeline orchestrator
- `remark-parse` — Markdown → MDAST
- `remark-frontmatter` — YAML block extraction
- `remark-gfm` — tables, footnotes, strikethrough, task lists, autolinks
- `yaml` — parse YAML strings
- `@myriaddreamin/typst.ts` — high-level compiler wrapper
- `@myriaddreamin/typst-ts-web-compiler` — WASM module

**Dev:**
- `vite`, `typescript`, `vitest`

No framework. No PDF viewer library (browser renders PDFs in `<iframe>`).

## Key design decisions

### 1. Escaping module (`typst-escape.ts`)

Escaping is a first-class subsystem, not a bullet point. Typst has context-sensitive syntax — escaping differs between:

- **Plain text**: escape `#`, `@`, `$`, `\`, `*`, `_`, `` ` ``, `[`, `]`, `<`, `>`
- **Inside content blocks** (`[...]`): same as plain text
- **Inside URLs** (`#link("...")`): escape `"`, `\`
- **Inside code**: no escaping (raw passthrough)
- **Inside labels**: restricted character set

The module exports context-specific functions: `escapeText()`, `escapeUrl()`, `escapeLabel()`. Each has dedicated test fixtures for brackets, quotes, colons, smart punctuation, adjacent markup, etc.

### 2. Metadata handling (`frontmatter.ts`)

YAML metadata is NOT injected via string interpolation. The flow is:

1. Parse YAML into a typed TypeScript interface: `{ title?: string, author?: string | string[], date?: string, ... }`
2. Validate and normalize (e.g., `author` string → single-element array)
3. Serialize through a strict Typst-value encoder that handles:
   - Strings with brackets/quotes/newlines → properly escaped `[...]` content blocks
   - Arrays → Typst array syntax `((name: [...]),)`
   - Missing fields → omitted (not null)
4. Output a safe `#show: doc => conf(...)` invocation

This prevents broken syntax, code injection from metadata, and type mismatches.

### 3. Footnote resolution

Not a simple inline replacement. Proper resolution pass:

1. **Collection pass**: walk tree, collect all `footnoteDefinition` nodes into `Map<id, Node[]>` with their full block content (may be multiple paragraphs)
2. **Reference pass**: for each `footnoteReference`, look up definition, track reference count
3. **Rendering rules**:
   - First reference to a footnote: render `#footnote[...full content...] <fn-id>` (labeled footnote)
   - Subsequent references to same footnote: render `@fn-id` (reference to the labeled footnote)
   - Missing definition: render warning placeholder
   - Orphan definition (no references): omit with warning
   - Content inside footnotes goes through the same `mdast-to-typst` serializer recursively

### 4. Table handling

GFM tables only (no Pandoc grid/pipe table extensions). Known constraints:

- Generated as `#table(columns: N, [cell], ...)`
- Column widths are Typst auto-sized, which matches the behavior of the Lua filter for the GFM table subset we support. This equivalence is scoped to our declared subset — Pandoc's full table model (grid tables, multiline cells, etc.) is broader than what remark-gfm produces.
- Header row styling handled by existing template rule `show table.cell.where(y: 0)`
- **Not supported**: column alignment (GFM `---:` syntax), merged cells, captions
- **Known difference from CLI**: Pandoc normalized whitespace in cells differently — our output may have minor spacing differences

### 5. List semantics

Handle tight vs loose lists explicitly:
- **Tight list** (no blank lines between items): items rendered without paragraph wrapping
- **Loose list** (blank lines between items): items wrapped in paragraphs (extra spacing)
- Nested lists: tracked via indent depth, output appropriately indented `- ` or `+ ` markers
- List items containing multiple blocks (paragraphs, code blocks): rendered with proper indentation continuation

### 6. WASM compiler wrapper (`typst-compiler.ts`)

Isolated behind a minimal API to guard against typst.ts pre-1.0 churn:

```typescript
interface TypstCompiler {
  init(): Promise<void>
  compile(source: string): Promise<Uint8Array>  // PDF bytes
  getErrors(): string[]
}
```

All typst.ts imports confined to this one file. Rest of the app only sees this interface.

### 7. Template strategy

The current `templates/md-template.typ` splits cleanly:
- **Lines 24-204**: Pure Typst `#let conf(...)` — copy verbatim into `template.ts` as a string constant
- **Lines 208-281**: Pandoc boilerplate — replaced by `frontmatter.ts` output

Final assembled source:
```
[template: horizontalrule + conf function definition]
[frontmatter: #show: doc => conf(...typed metadata...)]
[body: serialized MDAST]
```

### 8. Error recovery and preview stability

When the Typst compiler rejects generated markup (syntax error, missing font, etc.):
- The UI retains and displays the **last successful PDF** in the iframe — the preview never goes blank on a failed compile.
- Errors are shown in the status bar with the Typst error message.
- The download link stays pointed at the last successful PDF.
- This is especially important with auto-compilation: every keystroke temporarily produces invalid intermediate markup. The user should see stable output, not a flickering blank preview.

**Stale compile race handling:** With debounced auto-compile, async compiles can complete out of order. Each compile is assigned a monotonically increasing `jobId`. Results are only applied if `jobId === latestRequestedJobId` — stale success/error results are silently discarded. This prevents an older compile from overwriting the preview with stale PDF bytes.

**Object URL lifecycle:** Repeated recompiles create blob URLs for the iframe. To prevent memory leaks:
- Track `currentPdfUrl: string | null`
- Before replacing, call `URL.revokeObjectURL(currentPdfUrl)`
- Revoke again on page unload/teardown

### 9. Line-break semantics

We follow **CommonMark semantics** as implemented by `remark-parse`:
- **Soft breaks** (single newline in source): rendered as a space in Typst output. This matches CommonMark and Pandoc behavior.
- **Hard breaks** (trailing `\` or two trailing spaces before newline): rendered as `\` (Typst line break).
- **GitHub-style "every newline is a `<br>`"** is NOT supported. GitHub's rendering uses a non-standard extension. Adding this behavior would require the `remark-breaks` plugin, which could be offered as a user toggle in the future but is not included by default.

This means markdown written for GitHub with single-newline line breaks will reflow into continuous paragraphs. This is correct CommonMark behavior, not a bug.

### 10. UI and preview limitations

- Two-panel layout: textarea (left) + iframe PDF preview (right)
- Status bar: WASM init state, compile progress, warnings from unsupported nodes
- **Mobile limitation**: embedded PDF viewing (`<iframe>`) is inconsistent on mobile browsers. On mobile, fall back to download-only with a visible note. This is a known trade-off, not a bug.

## Phased implementation

### Phase 1 — Compiler proof of concept
1. Scaffold `web/` with Vite + TypeScript + vitest
2. Hardcode a minimal Typst document string (no markdown parsing yet)
3. Wire WASM compiler, confirm init → compile → PDF bytes
4. Create UI: textarea (shows raw Typst), button, iframe preview, download link
5. **Gate:** clicking Convert produces a valid PDF from hardcoded Typst. WASM loads, compiles, and previews successfully.

### Phase 2 — Core markdown subset
1. Implement `typst-escape.ts` with full test suite
2. Implement `mdast-to-typst.ts` for: headings, paragraphs, emphasis, strong, inline code, fenced code, links, soft/hard breaks
3. Port a **minimal template** into `template.ts`: page layout (A4, margins) + body font + basic heading sizes. Not full visual parity yet, but enough that output is readable and transform bugs are visible against styled output, not raw unstyled text.
4. Implement unsupported-node warning system with contextual placeholders
5. Wire unified pipeline (parse → transform → compile)
6. Add debounced auto-compilation (500ms idle) — this is a dev-time quality-of-life feature, not polish. Live feedback while building the transformer is essential.
7. Write fixture tests: each supported node type has a `.md` → `.typ` snapshot pair
8. **Gate:** typing markdown in textarea produces correct styled Typst for all Phase 2 nodes. Unsupported nodes show contextual warnings. Auto-recompilation works.

### Phase 3 — Structural markdown
1. Add lists (ordered, unordered, nested) with tight/loose semantics
2. Add blockquotes (including nested)
3. Add thematic breaks
4. More fixture tests, including nesting combinations (quote > list > paragraph, etc.)
5. **Gate:** structural nesting renders correctly. Fixtures pass.

### Phase 4 — Tables + footnotes
1. Add GFM table transform with documented limitations
2. Add footnote resolution pass (collection, reference counting, recursive rendering)
3. Add `frontmatter.ts` with typed schema + strict Typst value encoder
4. Fixture tests for: multi-column tables, multiple footnote references, footnotes in quotes/lists, metadata with special characters
5. **Gate:** `example.md` converts end-to-end and produces a structurally complete PDF.

### Phase 5 — Visual parity + template port
1. Port full `md-template.typ` styling into `template.ts` (all heading sizes, quote styles, code formatting, table styling, header/footer, page layout)
2. Compare PDF output against CLI-generated `output/example.pdf` for agreed fixtures
3. Document intentional visual differences (font fallback, spacing tolerances)
4. **Gate — concrete acceptance criteria:**
   - No missing semantic content on agreed fixtures (`example.md` + any added fixtures)
   - Zero unsupported-node warnings for `example.md`
   - Page count matches CLI output (within ±1 page tolerance for font-driven reflow)
   - Headings, tables, footnotes, and code blocks visually correct in side-by-side review
   - Documented differences limited to font substitution and minor spacing — not structural (missing content, wrong nesting, broken links)

### Phase 6 — Polish
1. Libertinus Serif font bundling (load via `$typst.setFonts()`)
2. Drag-and-drop `.md` files
3. Loading indicator + progress for WASM init
4. Mobile: detect and switch to download-only mode

### Future (not in scope)
- Image subsystem (async fetch, CORS handling, blob lifecycle, relative path resolution, dimension probing, caching — this is its own project)
- Mermaid support (client-side `mermaid` npm → SVG → embed)
- Strikethrough, task lists, autolinks
- Service worker for offline
- GitHub Pages deployment
- Custom font upload

## Test strategy

Not just visual comparison to `example.md`. Three layers:

1. **Snapshot tests** (`test/fixtures/`): pairs of `input.md` → `expected.typ`. Run via vitest. Covers each node type individually and in combination. Includes edge cases: special characters, empty content, deeply nested structures.

2. **Compile smoke tests**: take transformer output, pass through WASM compiler, assert it produces valid PDF bytes (non-zero length, correct magic bytes). Catches Typst syntax errors in generated markup.

3. **CLI parity regression tests**: a small set of fixtures (starting with `example.md`) where the web PDF output is compared against CLI-generated PDF output. Initially manual side-by-side comparison; later can use text extraction (e.g., pdf.js or `pdftotext`) to diff content programmatically. Catches semantic drift between the two pipelines.

4. **Edge-case fixtures**: dedicated tests for:
   - Escaping: brackets, quotes, colons, `#` in prose, `$` signs, backslashes
   - Footnotes: multiple refs, missing defs, block content, nested contexts
   - Lists: tight/loose, 3+ nesting levels, mixed ordered/unordered
   - Tables: varying column counts, empty cells, cells with formatting
   - Metadata: special characters in title/author, missing fields, multi-author

## Performance budget

- WASM init: < 5s on broadband (lazy load after page render, progress shown)
- Compilation of `example.md`: < 2s after init
- Total WASM + font payload: document the actual size, consider CDN with cache headers
- Memory: monitor for leaks on repeated compilations

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| WASM size (~10-15MB) | High | Lazy load, progress indicator, CDN hosting. Investigate whether typst.ts supports streaming compilation or splitting font payload from compiler payload. First-load UX on slow connections is a real concern for casual use. |
| Font availability | Low | Default fonts Phase 1-4, bundle custom in Phase 5 |
| typst.ts API churn (pre-1.0) | Medium | Pin exact versions, isolate behind wrapper interface |
| Escaping edge cases | High | First-class module with dedicated test suite |
| Footnote complexity | Medium | Proper resolution pass with reference counting |
| Table layout differences | Low | Documented GFM-only subset, auto-width matches Lua filter behavior |
| Metadata injection safety | Medium | Typed schema + strict encoder, no string interpolation |
| Mobile PDF preview | Low | Detect and fall back to download-only |
| Image handling | High | Deferred entirely — own subsystem in Future phase |

## Critical files
- `templates/md-template.typ` — source template to port (lines 24-204 are pure Typst to reuse)
- `example.md` — acceptance test document
- `cmd/converter.sh` — reference for current pipeline behavior
- `cmd/filters/auto-table-widths.lua` — confirms auto-width behavior our `#table()` approach solves
