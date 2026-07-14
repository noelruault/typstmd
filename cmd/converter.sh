#!/bin/bash

# THIS SCRIPT MUST BE RUN FROM THE ROOT DIRECTORY OF THE PROJECT
# USAGE: ./cmd/converter.sh <path-to-markdown-file> [--mermaid]

USE_MERMAID=false
INPUTARG=""

for arg in "$@"; do
    case "$arg" in
        --mermaid) USE_MERMAID=true ;;
        --*) echo "Unknown option: $arg"; exit 1 ;;
        *) INPUTARG="$arg" ;;
    esac
done

if [ -z "$INPUTARG" ]; then
    echo "Usage: $0 <path-to-markdown-file> [--mermaid]"
    exit 1
fi

if [ "${INPUTARG##*.}" != "md" ]; then
    echo "Warning: '$INPUTARG' is not a .md file. Please provide a markdown file."
    exit 1
fi

if ! command -v pandoc &> /dev/null; then
    echo "Error: pandoc is not installed. See https://pandoc.org/installing.html"
    exit 1
fi

if ! command -v typst &> /dev/null; then
    echo "Error: typst is not installed. See https://github.com/typst/typst"
    exit 1
fi

MERMAID_FILTER=""
if [ "$USE_MERMAID" = true ]; then
    if ! command -v mermaid-filter &> /dev/null; then
        echo "Error: mermaid-filter is not installed. Run: npm install -g mermaid-filter"
        exit 1
    fi
    export MERMAID_FILTER_FORMAT=png
    export MERMAID_FILTER_SCALE=4
    MERMAID_FILTER="-F mermaid-filter"
fi

INPUTFILE="$INPUTARG"
MARKDOWNFILE="$(basename "$INPUTFILE")"
FILENAME="${MARKDOWNFILE%.*}"
PDFFILE="${FILENAME}.pdf"
PANDOC_PATH="$(which pandoc)"
TEMPLATE_FILE_PATH="./templates/md-template.typ"
LUA_FILTER_PATH="./cmd/filters/auto-table-widths.lua"
PAGEBREAK_FILTER_PATH="./cmd/filters/pagebreak.lua"
OUTPUT_PATH="./output"

"$PANDOC_PATH" "$INPUTFILE" $MERMAID_FILTER --lua-filter="$LUA_FILTER_PATH" --lua-filter="$PAGEBREAK_FILTER_PATH" --pdf-engine=typst --template="$TEMPLATE_FILE_PATH" -o "$OUTPUT_PATH"/"$PDFFILE"
