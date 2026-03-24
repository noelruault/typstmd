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

This requires [mermaid-filter](https://github.com/raghur/mermaid-filter)

```bash
npm install -g mermaid-filter @mermaid-js/mermaid-cli
```
