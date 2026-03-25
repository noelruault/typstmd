import type { Theme } from "./index";

export const defaultTheme: Theme = {
  id: "default",
  name: "Default",
  template: `
#let horizontalrule = [
  #v(1pt)
  #line(start: (25%,0%), end: (75%,0%), stroke: 1pt + white)
  #v(1pt)
]

#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  font: "Linux Libertine",
  fontsize: 12pt,
  doc,
) = {
  set page(
    width: 210mm,
    height: 297mm,
    margin: (left: 2.5cm, top: 2cm, right: 2.5cm, bottom: 2cm),
    header: context {
      if counter(page).at(here()).first() > 1 [
        #set text(size: 10pt, style: "italic")
        #align(right)[#title]
      ]
    },
    footer: context {
      if counter(page).at(here()).first() > 0 [
        #set text(size: 10pt)
        #align(right)[#counter(page).display("1")]
      ]
    },
  )

  set par(
    first-line-indent: 0em,
    leading: 1.3em,
    spacing: 2em,
  )

  set text(
    lang: lang,
    font: font,
    size: fontsize,
  )

  // Block quotations
  set quote(block: true)
  show quote: set block(spacing: 2em)
  show quote: set pad(x: 2em)
  show quote: set par(leading: 1.3em)
  show quote: set text(style: "italic")

  // Code
  show raw: set block(inset: (left: 2em, top: 0.5em, right: 1em, bottom: 0.5em))
  show raw: set text(fill: rgb("#116611"), size: 9pt)

  // Footnotes
  set footnote.entry(indent: 0.5em)
  show footnote.entry: set par(hanging-indent: 1em)
  show footnote.entry: set text(size: 10pt)

  // Headings
  show heading: set text(hyphenate: false)

  show heading.where(level: 1): it => align(left, block(above: 1.5em, below: 1.5em, width: 80%)[
    #set text(font: font, weight: "semibold", size: 14pt)
    #block(it.body)
  ])

  show heading.where(level: 2): it => align(left, block(above: 1.3em, below: 1.3em, width: 80%)[
    #set text(font: font, weight: "semibold", size: 12pt)
    #block(it.body)
  ])

  show heading.where(level: 3): it => align(left, block(above: 1.3em, below: 1.3em)[
    #set text(font: font, weight: "regular", style: "italic", size: 11pt)
    #block(it.body)
  ])

  // Tables
  set table(inset: 8pt, stroke: 0.5pt + gray)
  show table.cell.where(y: 0): set text(weight: "semibold")

  // Links
  show link: underline
  show link: set text(fill: navy)

  // Title block
  if title != none {
    v(10pt)
    align(left, text(size: 20pt)[
      #set par(justify: false)
      #title
    ])
    v(2pt)
  }
  if date != none {
    align(left, text(size: 11pt)[#date])
    v(2pt)
  }
  line(start: (0%,0%), end: (100%,0%), stroke: 1pt + gray)
  v(2pt)

  counter(page).update(1)
  doc
}
`,
};
