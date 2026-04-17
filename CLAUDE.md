# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Typstmd converts Markdown files to PDF using a **Markdown → Pandoc → Typst → PDF** pipeline. The entire conversion is driven by a single shell script.

## Commands

```bash
# Convert a markdown file to PDF (must run from repo root)
./cmd/converter.sh example.md

# Convert with Mermaid diagram support
./cmd/converter.sh example.md --mermaid
```

Output goes to `./output/`. There are no tests, linters, or build steps.

## Architecture

The pipeline is linear and self-contained:

1. `cmd/converter.sh`: entry point. Validates dependencies, parses `--mermaid` flag, invokes Pandoc.
2. Pandoc receives the markdown and applies:
   - `cmd/filters/auto-table-widths.lua`: Lua filter that resets Pandoc's guessed column widths to `ColWidthDefault`, letting Typst auto-size tables.
   - Optional: `mermaid-filter` (external npm package) renders Mermaid code blocks to PNG.
   - `templates/md-template.typ`: Typst template controlling all PDF styling (A4, Libertinus Serif 12pt, headers/footers, code/quote/table formatting). This is a Pandoc template with `$variable$` interpolation, not a pure Typst file.
3. Typst (as Pandoc's `--pdf-engine`) compiles the Typst output to PDF.

Markdown files use YAML front matter (`title`, `author`, `date`) which the template interpolates into the title block.

## Dependencies

- **pandoc** and **typst** are required (script checks and exits if missing)
- **mermaid-filter** + **@mermaid-js/mermaid-cli** (npm, optional, only for `--mermaid`)

## Strict design guideline: Markdown/Typst separation

Markdown and Typst must remain strictly separate. The pipeline has two clean boundaries:

1. **Markdown layer** (remark plugins): transforms markdown syntax into MDAST nodes. All markdown-specific logic (emoji shortcodes, subscript syntax, GFM extensions) is resolved here. No Typst leaks into this layer.
2. **Typst layer** (serializer output): emits real, valid, idiomatic Typst code. Every line of generated output must be standalone Typst that any user could paste into a `.typ` file and compile independently.

**Rules:**
- Never invent custom Typst syntax, non-standard macros, or a hybrid format.
- Never blend markdown syntax into Typst output.
- Generated Typst must not depend on hidden context that isn't present in the output itself.
- Plugins must operate at the markdown parse layer (remark plugins) or produce standard Typst constructs. They must not change the core authoring model.
- The source view must show code that any Typst user would recognize as plain Typst.
- Only add plugin-specific Typst features when genuinely necessary (e.g., icon support not available natively in Typst).

## Known limitations

Check GitHub Issues labeled `improvement`:

```bash
gh issue list --label improvement
```
