# Typstmd

Converts markdown files into PDF using a Typst template

## Prerequisites

- [Pandoc](https://pandoc.org/installing.html)
- [Typst](https://github.com/typst/typst?tab=readme-ov-file#installation)

## Usage

```bash
git clone https://github.com/noelruault/typstmd \
    && cd typstmd \
    && chmod +x ./cmd/converter.sh \
    && ./cmd/converter.sh example.md
```

### Mermaid support

To render Mermaid diagrams in your markdown, use the `--mermaid` flag:

```bash
./cmd/converter.sh example.md --mermaid
```

No extra tool to install: Typst fetches the [merman](https://typst.app/universe/package/merman) package and draws the diagram as native Typst content (requires Typst 0.14+). Without the flag, a ` ```mermaid ` block prints its source. The web app renders the same way, on by default.
