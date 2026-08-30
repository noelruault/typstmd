# Self-hosted fonts

Unmodified copies of the faces the app loads on every compile, taken from
[typst-assets v0.13.1](https://github.com/typst/typst-assets/tree/v0.13.1/files/fonts)
(the same files typst.ts used to fetch from jsdelivr), committed here so no
third-party CDN sits in the compile path.

- Libertinus Serif (6 faces): SIL Open Font License 1.1, see LICENSE-Libertinus.txt
- DejaVu Sans Mono (4 faces): Bitstream Vera license + public domain changes, see LICENSE-DejaVu.txt

New Computer Modern (the `academic` theme) stays CDN-loaded via FONT_URLS: its
GUST Font License text was not obtainable to commit alongside, and shipping a
font without its license is not worth one theme.
