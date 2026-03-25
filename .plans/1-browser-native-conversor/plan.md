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

### Phase 1 — Compiler proof of concept ✓
1. Scaffold `web/` with Bun + TypeScript
2. Wire WASM compiler (`@myriaddreamin/typst.ts` v0.6.0), confirm init → compile → PDF bytes
3. Create UI: textarea, Convert button, iframe preview, download link
4. Bun dev server with COOP/COEP headers for SharedArrayBuffer
5. **Gate:** clicking Convert produces a valid PDF. WASM loads, compiles, and previews successfully.

### Phase 2 — Core markdown subset ✓
1. Implement `typst-escape.ts` with full test suite (30 tests: text, URL, label contexts)
2. Implement `mdast-to-typst.ts` for: headings, paragraphs, emphasis, strong, inline code, fenced code, links, soft/hard breaks
3. Implement unsupported-node warning system with contextual placeholders
4. Wire unified pipeline (parse → transform → compile) in `pipeline.ts`
5. Add debounced auto-compilation (500ms idle)
6. **Gate:** typing markdown produces correct styled Typst. Unsupported nodes show contextual warnings. Auto-recompilation works.

### Phase 3 — Structural markdown ✓
1. Add lists (ordered `+`, unordered `-`, nested with indent tracking)
2. Add blockquotes (including nested, via `#quote(block: true)[...]`)
3. Add thematic breaks (`#horizontalrule` variable reference)
4. **Gate:** structural nesting renders correctly.

### Phase 4 — Tables + footnotes + frontmatter ✓
1. GFM table transform: `#table(columns: N, [cell], ...)` with alignment warning
2. Footnote resolution: collection pass, reference counting, labeled footnotes (`<fn-id>` / `@fn-id`)
3. `frontmatter.ts`: YAML → typed Metadata → strict Typst value encoder with content blocks
4. **Gate:** `example.md` converts end-to-end and produces a structurally complete PDF.

### Phase 5 — Visual parity + themes ✓
1. Ported full `md-template.typ` styling into `themes/default.ts`
2. Added `themes/minimal.ts` (clean, wider margins, centered page numbers)
3. Added `themes/academic.ts` (New Computer Modern, justified, numbered headings)
4. Theme registry (`themes/index.ts`) + UI dropdown for runtime switching
5. Source/Editor toggle (Obsidian-style) showing full generated Typst source
6. **Known differences from CLI:** font depends on CDN availability (Libertinus Serif not bundled yet); `example.md` produces image/strikethrough/HTML warnings (deferred nodes)

### Phase 6 — Polish ✓
1. Drag-and-drop `.md` / `.markdown` files with visual overlay
2. Status bar with color-coded states (loading=blue, error=red, info=default)
3. Mobile-responsive layout (stacked panels below 768px, wrapping toolbar)
4. Auto-compile on init for immediate PDF preview

### Future (not in scope)
- Libertinus Serif font bundling (load via `$typst.setFonts()` for offline use)
- Image subsystem (async fetch, CORS handling, blob lifecycle, caching)
- Mermaid support (client-side `mermaid` npm → SVG → embed)
- Strikethrough, task lists, autolinks
- Service worker for offline
- GitHub Pages deployment
- Custom font upload
- Compile smoke tests via WASM (asserting valid PDF bytes from generated markup)

## Test strategy

96 tests across 5 test files, all using Bun's native test runner (`bun test`).

### Test files

1. **`test/typst-escape.test.ts`** (30 tests) — Context-sensitive escaping for text, URLs, labels. Covers: empty strings, all special chars, adjacent markup, smart punctuation, unicode preservation.

2. **`test/mdast-to-typst.test.ts`** (38 tests) — Unit tests for the MDAST→Typst serializer. Covers every supported node type + regression tests ensuring Typst function calls use `#` prefix (guards against the `horizontalrule` literal-text class of bug).

3. **`test/frontmatter.test.ts`** (14 tests) — YAML extraction + Typst encoding. Covers: missing frontmatter, single/multiple authors, special char escaping, empty metadata.

4. **`test/fixtures.test.ts`** (8 tests) — Snapshot tests using `.md` → `.typ` file pairs in `test/fixtures/`. Auto-discovers fixtures. Covers: headings, emphasis, code, links, lists, tables, blockquotes, escaping, footnotes.

5. **`test/pipeline.test.ts`** (6 tests) — Integration tests for the full pipeline. Covers: basic markdown, theme inclusion, frontmatter metadata, warning collection, theme switching, and `example.md` end-to-end conversion.

### Not yet implemented
- **Compile smoke tests**: passing generated Typst through WASM compiler to assert valid PDF output (requires WASM in test environment)
- **CLI parity regression**: side-by-side comparison of web vs CLI PDF output for `example.md`

## Project structure (actual)

```
web/
  index.html                    -- Two-panel UI with toolbar, editor, iframe preview
  package.json                  -- Bun scripts (dev, build, test), pinned deps
  tsconfig.json                 -- ES2022, bundler resolution, strict
  bun.lock
  .dev-dist/                    -- Dev server bundle output (gitignored)
  src/
    main.ts                     -- Bootstrap, UI events, drag-drop, source toggle
    pipeline.ts                 -- unified pipeline: parse → extract → transform → assemble
    mdast-to-typst.ts           -- MDAST tree → Typst markup (core serializer)
    typst-escape.ts             -- Context-aware escaping (text, URL, label)
    typst-compiler.ts           -- WASM compiler wrapper (pinned API surface)
    frontmatter.ts              -- YAML → typed Metadata → Typst value encoder
    warnings.ts                 -- Warning collector for unsupported/deferred nodes
    dev-server.ts               -- Bun.serve() dev server with COOP/COEP + bundling
    themes/
      index.ts                  -- Theme registry + getTheme()
      default.ts                -- Ported from md-template.typ (Linux Libertine, green code)
      minimal.ts                -- Clean minimal theme (11pt, centered page numbers)
      academic.ts               -- Academic theme (New Computer Modern, justified, numbered headings)
  test/
    typst-escape.test.ts        -- 30 escaping tests
    mdast-to-typst.test.ts      -- 38 serializer tests + regression guards
    frontmatter.test.ts         -- 14 metadata tests
    fixtures.test.ts            -- Snapshot test runner (auto-discovers .md/.typ pairs)
    pipeline.test.ts            -- 6 integration tests (incl. example.md e2e)
    fixtures/                   -- .md → .typ snapshot pairs
      headings.md / .typ
      emphasis.md / .typ
      code.md / .typ
      links.md / .typ
      lists.md / .typ
      table.md / .typ
      blockquote.md / .typ
      escaping.md / .typ
      footnotes.md / .typ
```

## Dependencies (actual)

**Runtime (pinned):**
- `unified@11.0.5`, `remark-parse@11.0.0`, `remark-frontmatter@5.0.0`, `remark-gfm@4.0.0`
- `yaml@2.7.1`
- `@myriaddreamin/typst.ts@0.6.0`, `@myriaddreamin/typst-ts-web-compiler@0.6.0`

**Dev:**
- `typescript@5.7.3`, `@types/bun@1.2.9`

No framework. No Vite. No Vitest. Bun handles dev server, bundling, and testing.

## Risks (updated)

| Risk | Severity | Status |
|---|---|---|
| WASM size (~10-15MB) | High | Accepted — lazy loaded after page render, status bar shows init state |
| Font availability | Medium | Using CDN fonts via `preloadRemoteFonts`. Offline/bundled fonts deferred to Future |
| typst.ts API churn (pre-1.0) | Medium | Mitigated — pinned v0.6.0, isolated behind `TypstCompiler` interface |
| Escaping edge cases | Low | Mitigated — first-class module with 30 dedicated tests |
| Footnote complexity | Low | Mitigated — proper resolution pass with reference counting, 3 dedicated tests |
| Mobile PDF preview | Low | Accepted — responsive layout implemented, download link always available |
| Image handling | High | Deferred entirely |

## Critical files
- `templates/md-template.typ` — original template (ported to `themes/default.ts`)
- `example.md` — acceptance test document (tested in `pipeline.test.ts`)
- `cmd/converter.sh` — CLI pipeline reference
- `cmd/filters/auto-table-widths.lua` — confirms auto-width behavior our `#table()` approach solves
