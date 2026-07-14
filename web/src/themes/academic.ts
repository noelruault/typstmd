import type { Theme } from "./index";

export const academicTheme: Theme = {
  id: "academic",
  name: "Academic",
  template: `
#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  toc: false,
  font: "New Computer Modern",
  fontsize: 11pt,
  doc,
) = {
  set page(
    width: 210mm,
    height: 297mm,
    margin: (left: 2.5cm, top: 2.5cm, right: 2.5cm, bottom: 2.5cm),
    header: context {
      if counter(page).at(here()).first() > 1 [
        #set text(size: 9pt, style: "italic", fill: luma(100))
        #align(right)[#title]
      ]
    },
    footer: context {
      if counter(page).at(here()).first() > 0 [
        #set text(size: 9pt)
        #align(center)[#counter(page).display("1")]
      ]
    },
  )

  set par(
    first-line-indent: 1.5em,
    leading: 0.8em,
    spacing: 1.2em,
    justify: true,
  )

  set text(
    lang: lang,
    font: (font, "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji"),
    size: fontsize,
  )

  // Block quotations
  set quote(block: true)
  show quote: set block(spacing: 1.2em)
  show quote: set pad(x: 2em)
  show quote: set text(size: 10pt)

  // Code
  show raw: set block(
    inset: (left: 1em, top: 0.5em, right: 1em, bottom: 0.5em),
    stroke: 0.4pt + luma(220),
    radius: 2pt,
  )
  show raw: set text(size: 9pt)
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

  // Headings: numbered
  set heading(numbering: "1.1.")
  show heading: set text(hyphenate: false)

  show heading.where(level: 1): it => block(above: 2em, below: 1em)[
    #set text(weight: "bold", size: 18pt)
    #show raw: set text(size: 1em)
    #it
  ]

  show heading.where(level: 2): it => block(above: 1.5em, below: 0.8em)[
    #set text(weight: "bold", size: 15pt)
    #show raw: set text(size: 1em)
    #it
  ]

  show heading.where(level: 3): it => block(above: 1.2em, below: 0.6em)[
    #set text(weight: "semibold", style: "italic", size: 13pt)
    #show raw: set text(size: 1em)
    #it
  ]

  show heading.where(level: 4): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "bold", size: 12pt)
    #show raw: set text(size: 1em)
    #it
  ]

  show heading.where(level: 5): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "bold", size: 11pt)
    #show raw: set text(size: 1em)
    #it
  ]

  show heading.where(level: 6): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "regular", style: "italic", size: 11pt)
    #show raw: set text(size: 1em)
    #it
  ]

  // Tables
  set table(inset: 6pt, stroke: (x: none, y: 0.5pt + black))
  show table.cell.where(y: 0): set text(weight: "bold", size: 10pt)

  // Links
  show link: set text(fill: rgb("#1a0dab"))

  // Title page (rendered when frontmatter supplies a title)
  if title != none {
    page(header: none, footer: none)[
      #v(1fr)
      #align(center)[
        #text(font: font, size: 24pt, weight: "bold")[#title]
        #if authors.len() > 0 {
          v(1.2em)
          text(size: 13pt)[#authors.map(a => a.name).join(", ")]
        }
        #if date != none {
          v(0.6em)
          text(size: 11pt, style: "italic")[#date]
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
