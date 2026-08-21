import type { Theme } from "./index";

export const aitelierTheme: Theme = {
  id: "aitelier",
  name: "Aitelier",
  fonts: { families: ["Libertinus Serif", "DejaVu Sans Mono"], assets: ["text"] },
  template: `
#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  toc: false,
  font: "Libertinus Serif",
  fontsize: 11pt,
  doc,
) = {
  let paper-fill = rgb("#f4ede2")
  let ink = rgb("#1d1a17")
  let muted = rgb("#6b625a")
  let rule = rgb("#d6c9b3")
  let accent = rgb("#7a1c1c")
  let label-font = "DejaVu Sans Mono"

  set page(
    width: 210mm,
    height: 297mm,
    margin: (left: 2.6cm, top: 2.2cm, right: 2.6cm, bottom: 2cm),
    fill: paper-fill,
    footer: context {
      if counter(page).at(here()).first() > 0 [
        #set text(font: label-font, size: 8pt, fill: muted)
        #align(right)[#counter(page).display("1")]
      ]
    },
  )

  // VERTICAL RHYTHM CONTRACT — see CLAUDE.md "Theme spacing rules (vertical rhythm + WCAG)".
  // Ordering that must hold: above-heading > paragraph-spacing > below-heading > line-leading.
  set par(
    first-line-indent: 0em,
    leading: 0.85em,
    spacing: 2em,
  )

  set text(
    lang: lang,
    font: font,
    size: fontsize,
    fill: ink,
  )

  // Block quotations
  set quote(block: true)
  show quote: set block(spacing: 2em)
  show quote: set pad(left: 1.4em)
  show quote: set text(fill: muted, style: "italic")

  // Code
  show raw: set block(inset: (left: 1.4em, top: 0.5em, right: 0.8em, bottom: 0.5em))
  // Relative so code scales with its context; an absolute size renders title code at body size.
  show raw: set text(font: label-font, fill: accent, size: 0.78em)
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
  show footnote.entry: set text(size: 9pt, fill: muted)

  // Headings
  show heading: set text(hyphenate: false)

  // A display line closed by an accent period, echoing the printed CV this theme comes from.
  show heading.where(level: 1): it => block(above: 2.6em, below: 1.2em, width: 100%)[
    #set text(weight: "bold", size: 23pt)
    #set par(leading: 0.85em)
    #it.body#text(fill: accent)[.]
  ]

  // Section marker: a short accent rule, then a letterspaced mono label.
  show heading.where(level: 2): it => block(above: 2.4em, below: 1.1em, width: 100%)[
    #grid(
      columns: (auto, auto),
      column-gutter: 0.55em,
      align: horizon,
      line(length: 1.2em, stroke: 1.4pt + accent),
      text(font: label-font, size: 0.78em, weight: "bold", tracking: 0.16em, fill: muted)[
        #upper(it.body)
      ],
    )
  ]

  show heading.where(level: 3): it => block(above: 2.2em, below: 1em, width: 100%)[
    #set text(weight: "semibold", size: 14pt)
    #set par(leading: 0.85em)
    #it.body
  ]

  show heading.where(level: 4): it => block(above: 2.2em, below: 0.9em, width: 100%)[
    #set text(weight: "bold", size: 12pt)
    #set par(leading: 0.85em)
    #it.body
  ]

  show heading.where(level: 5): it => block(above: 2.2em, below: 0.85em, width: 100%)[
    #set text(weight: "bold", size: 11pt, fill: muted)
    #set par(leading: 0.85em)
    #it.body
  ]

  show heading.where(level: 6): it => block(above: 2.2em, below: 0.85em, width: 100%)[
    #set text(weight: "regular", style: "italic", size: 11pt, fill: muted)
    #set par(leading: 0.85em)
    #it.body
  ]

  // Tables: horizontal rules only, so they sit on the paper rather than in a box.
  set table(inset: (x: 0pt, y: 6pt), stroke: none, column-gutter: 0.9em)
  show table: it => block(
    above: 2em,
    below: 2em,
    stroke: (top: 0.6pt + rule, bottom: 0.6pt + rule),
    inset: (y: 4pt),
    it,
  )
  show table.cell.where(y: 0): set text(
    font: label-font,
    size: 0.72em,
    weight: "bold",
    tracking: 0.08em,
    fill: accent,
  )
  show table.cell.where(y: 0): it => upper(it)

  // Links
  show link: set text(fill: accent)

  // Title page (rendered when frontmatter supplies a title)
  if title != none {
    page(footer: none)[
      #v(1fr)
      #align(left)[
        #text(weight: "bold", size: 30pt)[#title#text(fill: accent)[.]]
        #if authors.len() > 0 {
          v(1.4em)
          text(font: label-font, size: 10pt, tracking: 0.1em, fill: muted)[
            #upper(authors.map(a => a.name).join(" · "))
          ]
        }
        #if date != none {
          v(0.7em)
          text(font: label-font, size: 9pt, fill: muted)[#date]
        }
      ]
      #v(2fr)
      #line(length: 100%, stroke: 0.6pt + rule)
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
