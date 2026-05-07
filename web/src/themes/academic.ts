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
    #set text(weight: "bold", size: 14pt)
    #it
  ]

  show heading.where(level: 2): it => block(above: 1.5em, below: 0.8em)[
    #set text(weight: "bold", size: 12pt)
    #it
  ]

  show heading.where(level: 3): it => block(above: 1.2em, below: 0.6em)[
    #set text(weight: "semibold", style: "italic", size: 11pt)
    #it
  ]

  show heading.where(level: 4): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "bold", size: 11pt)
    #it
  ]

  show heading.where(level: 5): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "semibold", style: "italic", size: 11pt)
    #it
  ]

  show heading.where(level: 6): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "regular", style: "italic", size: 11pt)
    #it
  ]

  // Tables
  set table(inset: 6pt, stroke: (x: none, y: 0.5pt + black))
  show table.cell.where(y: 0): set text(weight: "bold", size: 10pt)

  // Links
  show link: set text(fill: rgb("#1a0dab"))

  // Title block
  if title != none {
    v(3em)
    align(center)[
      #text(size: 18pt, weight: "bold")[#title]
    ]
    v(0.5em)
  }
  if authors.len() > 0 {
    align(center)[
      #text(size: 11pt)[#authors.map(a => a.name).join(", ")]
    ]
    v(0.3em)
  }
  if date != none {
    align(center)[
      #text(size: 10pt, style: "italic")[#date]
    ]
    v(2em)
  }

  counter(page).update(1)
  doc
}
`,
};
