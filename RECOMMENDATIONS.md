# Recommendations

Ordered chronologically. Check back before starting new work to see if any are stale.

---

### 2026-03-26 — Deploy as static files, not a Worker

The app is fully client-side. The JS bundle is 314KB minified. The WASM compiler is 21MB and loads lazily in the browser. Fonts come from GitHub CDN.

**Deploy to Cloudflare Pages, GitHub Pages, or any static CDN.** No server or Worker needed.

A Cloudflare Worker won't work for server-side compilation:
- 10MB bundle limit (paid) — the 21MB WASM doesn't fit
- No SharedArrayBuffer in Workers
- Would require a fundamentally different architecture

The remark plugins (unified, remark-parse, remark-gfm, etc.) are pure JS AST transforms bundled into the client. Adding more plugins (remark-emoji, remark-sub-super) adds ~10-30KB each. Not a concern for bundle size.

---

### 2026-03-26 — Font bundling before going offline

Fonts are currently loaded from GitHub CDN via `preloadRemoteFonts`. This means:
- Offline / air-gapped use produces font fallback (different layout, missing glyphs)
- First load on slow connections delays text rendering
- Theme fidelity varies silently when fonts are unavailable

When offline support matters, bundle Libertinus Serif (or the theme's primary font) locally and load via the compiler's `addSource()` or font API. This is a separate task from the emoji font fallback (which depends on system fonts and can't be easily bundled due to size — Apple Color Emoji is ~100MB).

---

### 2026-03-26 — RESOLVED: Horizontal rule, strikethrough, emoji, images (CLI)

All resolved in plan 2 implementation:
- Horizontal rule extracted to shared preamble (visible in all themes)
- Strikethrough: `#strike[text]` via remark-gfm delete nodes
- Emoji: font fallback in themes + `remark-emoji` for colon syntax
- Images (CLI): `#figure(image("path"))` for local files; remote URLs still produce placeholders
- Sub/superscript: `#sub`/`#super` via custom remark plugin
- Highlight: `#highlight` via custom remark plugin
- Note: `singleTilde: false` configured in remark-gfm to free `~text~` for subscript

---

### 2026-03-26 — Compile smoke tests require `typst` CLI

The compile smoke test suite (`test/compile-smoke.test.ts`) shells out to `typst compile`. It passes silently if `typst` is not installed (tests skip, not fail). This means CI without `typst` installed won't catch Typst syntax errors. When setting up CI, install `typst` as a dependency or the smoke tests provide no value.

---

### 2026-03-26 — CLI parity regression needs `pdftotext`

Full text-diff parity between web and CLI PDF output requires `pdftotext` or equivalent tool. Currently only validated via structural assertions and visual inspection. Install `poppler-utils` (provides `pdftotext`) in CI if automated parity checking is needed.
