import type { Theme } from "./index";

export const minimalTheme: Theme = {
  id: "minimal",
  name: "Minimal",
  template: `
#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  toc: false,
  font: "Linux Libertine",
  fontsize: 11pt,
  doc,
) = {
  set page(
    width: 210mm,
    height: 297mm,
    margin: (left: 3cm, top: 2.5cm, right: 3cm, bottom: 2.5cm),
    footer: context {
      if counter(page).at(here()).first() > 0 [
        #set text(size: 9pt, fill: luma(150))
        #align(center)[#counter(page).display("1")]
      ]
    },
  )

  set par(
    first-line-indent: 0em,
    leading: 1.1em,
    spacing: 1.4em,
  )

  set text(
    lang: lang,
    font: (font, "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji"),
    size: fontsize,
  )

  // Block quotations
  set quote(block: true)
  show quote: set block(spacing: 1.4em)
  show quote: set pad(left: 1.5em)
  show quote: set text(fill: luma(80))

  // Code
  show raw: set block(inset: (left: 1.5em, top: 0.4em, right: 0.8em, bottom: 0.4em))
  show raw: set text(fill: luma(60), size: 9pt)
  // Code keeps its own tight line spacing instead of the body's loose leading.
  show raw.where(block: true): set par(leading: 0.65em, spacing: 0.65em)
  // Break long space-less comma runs (numeric IN-lists) so they wrap instead of overflowing; without a break point Typst drops the indent and opens a gap. Trade-off: copied code carries these invisible breaks.
  show raw.where(block: true): it => {
    show regex(","): m => m.text + "\u{200B}"
    it
  }
  show raw.where(block: false): it => {
    show regex("[-_./:]"): m => m.text + "\u{200B}"
    it
  }

  // Footnotes
  set footnote.entry(indent: 0.5em)
  show footnote.entry: set par(hanging-indent: 1em)
  show footnote.entry: set text(size: 9pt)

  // Headings
  show heading: set text(hyphenate: false)

  show heading.where(level: 1): it => block(above: 2em, below: 1em)[
    #set text(weight: "bold", size: 22pt)
    #show raw: set text(size: 1em)
    #it.body
  ]

  show heading.where(level: 2): it => block(above: 1.5em, below: 0.8em)[
    #set text(weight: "semibold", size: 16pt)
    #show raw: set text(size: 1em)
    #it.body
  ]

  show heading.where(level: 3): it => block(above: 1.2em, below: 0.6em)[
    #set text(weight: "semibold", size: 14pt, fill: luma(60))
    #show raw: set text(size: 1em)
    #it.body
  ]

  show heading.where(level: 4): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "bold", size: 12pt)
    #show raw: set text(size: 1em)
    #it.body
  ]

  show heading.where(level: 5): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "bold", size: 11pt)
    #show raw: set text(size: 1em)
    #it.body
  ]

  show heading.where(level: 6): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "regular", style: "italic", size: 11pt, fill: luma(100))
    #show raw: set text(size: 1em)
    #it.body
  ]

  // Tables
  set table(inset: 6pt, stroke: 0.4pt + luma(200))
  show table.cell.where(y: 0): set text(weight: "semibold", size: 10pt)

  // Links
  show link: set text(fill: rgb("#1a6dd4"))

  // Title page (rendered when frontmatter supplies a title)
  if title != none {
    page(footer: none)[
      #v(1fr)
      #align(center)[
        #text(font: font, weight: "bold", size: 26pt)[#title]
        #if authors.len() > 0 {
          v(1.2em)
          text(size: 13pt)[#authors.map(a => a.name).join(", ")]
        }
        #if date != none {
          v(0.6em)
          text(size: 11pt, fill: luma(120))[#date]
        }
      ]
      #v(2fr)
    ]
  }

  counter(page).update(1)

  // Auto-generated table of contents (enabled by the toc frontmatter flag)
  if toc {
    outline(title: [Contents], depth: 3, indent: auto)
    pagebreak()
  }

  doc
}
`,
};
