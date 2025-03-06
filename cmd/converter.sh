#!/bin/bash

# THIS SCRIPT MUST BE RUN FROM THE ROOT DIRECTORY OF THE PROJECT
# USAGE: ./cmd/converter.sh <path-to-markdown-file>

INPUTFILE="$1"
MARKDOWNFILE="$(basename "$INPUTFILE")"
FILENAME="${MARKDOWNFILE%.*}"
PDFFILE="${FILENAME}.pdf"
PANDOC_PATH="$(which pandoc)"
TEMPLATE_FILE_PATH="./templates/md-template.typ"
OUTPUT_PATH="./output"

"$PANDOC_PATH" "$INPUTFILE" --pdf-engine=typst --template="$TEMPLATE_FILE_PATH" -o "$OUTPUT_PATH"/"$PDFFILE"
