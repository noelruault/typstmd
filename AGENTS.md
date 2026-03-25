# AGENTS.md

This file provides context for AI agents working on this project.

## Project overview

Typstmd converts Markdown files to PDF using Pandoc with a Typst template.

## Key files

- `cmd/converter.sh` - main conversion script
- `cmd/filters/auto-table-widths.lua` - Pandoc Lua filter for table column sizing
- `templates/md-template.typ` - Typst template for PDF layout

## Known limitations

Check GitHub Issues labeled `improvement` for known limitations and enhancement opportunities:

```bash
gh issue list --label improvement
```

When asked to improve this project, check these issues first and attempt to resolve any that are unblocked.
