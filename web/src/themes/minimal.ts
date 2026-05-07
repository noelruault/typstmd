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
    #it.body
  ]

  show heading.where(level: 2): it => block(above: 1.5em, below: 0.8em)[
    #set text(weight: "semibold", size: 16pt)
    #it.body
  ]

  show heading.where(level: 3): it => block(above: 1.2em, below: 0.6em)[
    #set text(weight: "semibold", size: 13pt, fill: luma(60))
    #it.body
  ]

  show heading.where(level: 4): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "bold", size: 11pt)
    #it.body
  ]

  show heading.where(level: 5): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "semibold", size: 11pt)
    #it.body
  ]

  show heading.where(level: 6): it => block(above: 1em, below: 0.5em)[
    #set text(weight: "regular", style: "italic", size: 11pt, fill: luma(100))
    #it.body
  ]

  // Tables
  set table(inset: 6pt, stroke: 0.4pt + luma(200))
  show table.cell.where(y: 0): set text(weight: "semibold", size: 10pt)

  // Links
  show link: set text(fill: rgb("#1a6dd4"))

  // Title block
  if title != none {
    v(2em)
    text(size: 22pt, weight: "bold")[#title]
    v(0.5em)
  }
  if date != none {
    text(size: 10pt, fill: luma(120))[#date]
    v(1em)
  }

  counter(page).update(1)
  doc
}
`,
};
