import type { Theme } from "./index";

export const defaultTheme: Theme = {
  id: "default",
  name: "Default",
  fonts: { families: ["Libertinus Serif"], assets: ["text"] },
  template: `
#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  toc: false,
  font: "Libertinus Serif",
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

  // VERTICAL RHYTHM CONTRACT — do not tune these values in isolation; see CLAUDE.md "Theme spacing rules (vertical rhythm + WCAG)".
  // Ordering that must hold: above-heading > paragraph-spacing > below-heading > line-leading. Changing one value without the others breaks the hierarchy.
  // Spacing meets WCAG 2.2 SC 1.4.12 (Text Spacing): line-height >= 1.5x the font size (leading 0.85em measures to a 1.5 line-height ratio) and paragraph spacing >= 2x the font size.
  set par(
    first-line-indent: 0em,
    leading: 0.85em,
    spacing: 2em,
  )

  // WCAG 1.4.12 also allows letter-spacing (0.12x) and word-spacing (0.16x), but those are left to the reader/browser rather than baked in: forcing them alters the typeface's texture (reads as a font change), and the criterion only requires content to survive a user applying them.
  set text(
    lang: lang,
    font: font,
    size: fontsize,
  )

  // Block quotations
  set quote(block: true)
  show quote: set block(spacing: 2em)
  show quote: set pad(x: 2em)
  show quote: set par(leading: 0.85em)
  show quote: set text(style: "italic")

  // Code
  show raw: set block(inset: (left: 2em, top: 0.5em, right: 1em, bottom: 0.5em))
  // Relative so code scales with its context; an absolute size renders title code at body size.
  show raw: set text(fill: rgb("#116611"), size: 0.75em)
  // Code keeps its own tight line spacing instead of the body's 1.5 line-height.
  show raw.where(block: true): set par(leading: 0.65em, spacing: 0.65em)
  // Break long space-less comma runs (numeric IN-lists) so they wrap instead of overflowing; without a break point Typst drops the indent and opens a gap. Trade-off: copied code carries these invisible breaks.
  show raw.where(block: true): it => {
    show regex(","): m => m.text + "\u{200B}"
    it
  }
  // Allow inline code (long identifiers, paths, dotted names) to wrap inside narrow contexts like table cells by inserting zero-width breakpoints after common identifier separators.
  show raw.where(block: false): it => {
    show regex("[-_./:]"): m => m.text + "\u{200B}"
    it
  }

  // Footnotes
  set footnote.entry(indent: 0.5em)
  show footnote.entry: set par(hanging-indent: 1em)
  show footnote.entry: set text(size: 10pt)

  // Headings
  show heading: set text(hyphenate: false)

  show heading.where(level: 1): it => align(left, block(above: 2.8em, below: 1.2em, width: 100%)[
    #set text(font: font, weight: "semibold", size: 22pt)
    #set par(leading: 0.85em)
    #block(it.body)
  ])

  show heading.where(level: 2): it => align(left, block(above: 2.6em, below: 1.1em, width: 100%)[
    #set text(font: font, weight: "semibold", size: 17pt)
    #set par(leading: 0.85em)
    #block(it.body)
  ])

  show heading.where(level: 3): it => align(left, block(above: 2.4em, below: 1em, width: 100%)[
    #set text(font: font, weight: "semibold", size: 15pt)
    #set par(leading: 0.85em)
    #block(it.body)
  ])

  show heading.where(level: 4): it => align(left, block(above: 2.2em, below: 0.9em, width: 100%)[
    #set text(font: font, weight: "bold", size: 13pt)
    #set par(leading: 0.85em)
    #block(it.body)
  ])

  show heading.where(level: 5): it => align(left, block(above: 2.2em, below: 0.85em, width: 100%)[
    #set text(font: font, weight: "bold", size: 12pt)
    #set par(leading: 0.85em)
    #block(it.body)
  ])

  show heading.where(level: 6): it => align(left, block(above: 2.2em, below: 0.85em, width: 100%)[
    #set text(font: font, weight: "regular", style: "italic", size: 12pt)
    #set par(leading: 0.85em)
    #block(it.body)
  ])

  // Tables
  set table(inset: 8pt, stroke: 0.5pt + gray)
  show table.cell.where(y: 0): set text(weight: "semibold")

  // Links
  show link: underline
  show link: set text(fill: navy)

  // Title page (rendered when frontmatter supplies a title)
  if title != none {
    page(header: none, footer: none)[
      #v(1fr)
      #align(center)[
        #text(font: font, weight: "bold", size: 28pt)[#title]
        #if authors.len() > 0 {
          v(1.5em)
          text(size: 14pt)[#authors.map(a => a.name).join(", ")]
        }
        #if date != none {
          v(0.8em)
          text(size: 12pt, fill: luma(90))[#date]
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
