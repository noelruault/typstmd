# Plan: Theme Consistency + Feature Expansion

## Problem Statement

Three issues surfaced from reviewing the `example.md` PDF output across all three themes:

1. **Horizontal rules are inconsistent** — default theme uses `stroke: white` (invisible on white page), minimal uses 30% width gray, academic uses 100% width gray. The `#let horizontalrule` is defined independently in each theme with no shared contract.
2. **Supported Typst features emit placeholders** — strikethrough (`~~text~~`) produces `[ Strikethrough ]` even though Typst has `#strike[text]`. Same for images.
3. **Emoji and unicode** — `🥴` won't render because default fonts lack emoji glyphs. Colon syntax (`:wink:`) isn't parsed.

## Part 1 — Horizontal Rule Consistency

### Problem

`#let horizontalrule` is duplicated in each theme file with different definitions:

| Theme | Width | Color | Spacing |
|---|---|---|---|
| default | 50% (25%-75%) | **white** (invisible) | 1pt |
| minimal | 30% | luma(180) | 6pt |
| academic | 100% | luma(200) | 4pt |

The default theme's white rule is a bug — it was copied from `md-template.typ` where it acted as a spacer between the title block and body, not as a content `---` separator.

### Fix

Move `#let horizontalrule` out of themes into a shared preamble emitted by the pipeline. Give it a sensible visible default. Themes can override via show rules if they need custom styling, but the base behavior is always visible.

**Shared default:**
```typst
#let horizontalrule = [
  #v(6pt)
  #line(length: 100%, stroke: 0.5pt + luma(180))
  #v(6pt)
]
```

**Changes required:**
- Remove `#let horizontalrule` from all three theme files
- Add the shared definition to pipeline output (before theme template)
- Themes that want custom styling can `#let horizontalrule = [...]` to override
- Update fixture tests

## Part 2 — Strikethrough (`~~text~~`)

### Current state

remark-gfm parses `~~text~~` into a `delete` MDAST node. The serializer emits a placeholder `[ ~~text~~ ]` and warns.

### Fix

Replace placeholder with `#strike[children]`. One case change in `mdast-to-typst.ts`:

```typescript
case "delete":
  return `#strike[${serializeChildren(node)}]`;
```

- Remove the warning for `delete` — it's now supported
- Update tests: remove delete from expected warnings, add positive test
- Update compatibility table in plan 1

## Part 3 — Emoji Support

### 3a. Unicode emoji rendering (font fallback)

**Problem:** Typst renders text with the configured font. If that font doesn't have emoji glyphs (Linux Libertine, New Computer Modern don't), emoji characters render as blank/tofu.

**Fix:** Add emoji font fallback in each theme's `set text()`:
```typst
set text(font: (font, "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji"))
```

This makes raw unicode emoji (`🥴`, `👍`) render correctly with zero parser changes. The platform's native emoji font is used as fallback.

**Note:** This works in CLI (`typst compile`) because system fonts are available. In WASM (browser), font availability depends on what's loaded via `preloadRemoteFonts`. The emoji fallback will silently degrade to tofu in WASM if no emoji font is loaded — same as current behavior, no regression.

### 3b. Colon emoji syntax (`:wink:` → unicode)

**Problem:** remark-gfm doesn't parse `:emoji_name:` syntax. It stays as literal text.

**Fix:** Add `remark-emoji` plugin:
```bash
cd web && bun add remark-emoji
```

Then in `pipeline.ts`:
```typescript
import remarkEmoji from "remark-emoji";
// in pipeline:
.use(remarkEmoji)
```

This converts `:wink:` → `😉` during MDAST parsing. The unicode character then renders via the font fallback from 3a.

## Part 4 — Images

### Current state

`image` nodes produce `[Image: alt]` placeholders. Images were deferred because of browser-side complexity (CORS, async fetch, blob lifecycle).

### Approach: CLI-first, WASM-placeholder

For `typst compile` (CLI), `#image("url")` works for local paths. Remote URLs work if Typst can fetch them (Typst 0.12+ supports this).

**Serializer change:**
```typescript
case "image":
  const alt = node.alt || "";
  const url = node.url || "";
  if (url) {
    return `#figure(image("${escapeUrl(url)}"), caption: [${escapeText(alt)}])`;
  }
  // No URL — keep placeholder
  return `\\[Image: ${escapeText(alt || "no source")}\\]`;
```

**Limitations (document clearly):**
- CLI: local paths and some remote URLs work
- WASM: images won't load (Typst WASM can't fetch URLs). Keep the placeholder behavior for WASM with a warning.
- Future: WASM image support needs `fetch()` → `addSource("/images/name.png", bytes)` pipeline — separate project.

### imageReference / definition resolution

`![Alt text][id]` with `[id]: url "title"` is a reference-style image. remark-gfm produces `imageReference` + `definition` nodes.

**Fix:** Collect `definition` nodes (like footnotes), resolve `imageReference` → look up URL from definitions → emit same `#figure(image(...))` output.

## Part 5 — Subscript / Superscript

### Current state

`H~2~O` and `19^th^` are parsed as literal text by remark-gfm. The `~` and `^` delimiters are markdown-it extensions, not GFM.

### Fix

Add `remark-sub-super` (or equivalent) plugin:
```bash
cd web && bun add remark-sub-super
```

This produces `subscript` and `superscript` MDAST nodes. Then in serializer:
```typescript
case "subscript":
  return `#sub[${serializeChildren(node)}]`;
case "superscript":
  return `#super[${serializeChildren(node)}]`;
```

## Part 6 — Highlight (`==text==`)

### Current state

Parsed as literal text. Not in GFM spec.

### Fix

Needs a remark plugin that parses `==text==` into a `mark` or `highlight` node. Options:
- `remark-mark-highlight` (if it exists and is maintained)
- Custom remark plugin (small, ~20 lines)

Typst output: `#highlight[text]`

**Lower priority** — less commonly used than strikethrough or emoji.

## Not in scope

| Feature | Reason |
|---|---|
| `++inserted++` | No standard remark plugin, niche markdown-it syntax |
| Definition lists | Not in CommonMark/GFM, no reliable remark plugin |
| Abbreviations `*[HTML]:` | markdown-it extension, remark doesn't parse it |
| Custom containers `:::` | Would need `remark-directive`, different content model |
| Autolinks (bare URLs) | remark-gfm has autolink support — produces `link` nodes which we already handle. Check if it's actually working. |

## Implementation Order

| Step | Feature | Effort | Dependencies |
|---|---|---|---|
| 1 | Horizontal rule consistency | Small | None — template change only |
| 2 | Strikethrough `#strike[]` | Trivial | None — already parsed |
| 3 | Emoji font fallback | Small | None — template change only |
| 4 | Emoji colon syntax | Small | `remark-emoji` plugin |
| 5 | Images (CLI path) | Medium | Serializer + definition resolution |
| 6 | Sub/superscript | Small | `remark-sub-super` plugin |
| 7 | Highlight | Small | Remark plugin (TBD) |
| 8 | Images (WASM path) | Large | Fetch + blob + mapShadow subsystem |

Steps 1-4 can be done in a single session. Step 5 is a focused half-session. Steps 6-7 are independent and can be done in any order. Step 8 is a separate project.

## Test updates required

Each step needs:
- Updated serializer unit tests (new positive cases, remove placeholder expectations)
- Updated fixture `.md`/`.typ` pairs where relevant
- Updated compile smoke tests (verify new output compiles)
- Updated pipeline test warning expectations (remove warnings for newly-supported types)
- Updated compatibility table in plan 1
