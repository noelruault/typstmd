#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  toc: false,
  paper: "a4",
  font: "Libertinus Serif",
  fontsize: 10pt,
  doc,
) = {
  // IEEE page geometry — verified against ieee-pages-and-margins-2016.pdf.
  let margins = if paper == "a4" {
    (top: 19mm, bottom: 43mm, x: 12.925mm)
  } else {
    (top: 0.75in, bottom: 1in, x: 0.625in)
  }
  let gutter = if paper == "a4" { 6.35mm } else { 0.25in }

  // Body pages carry a centered page number; the cover and TOC opt out below.
  set page(paper: paper, margin: margins, footer: context {
    set align(center)
    set text(size: 9pt)
    counter(page).display("1")
  })
  set text(
    lang: lang,
    font: font,
    size: fontsize,
  )
  // Body: fully justified, single-spaced, 1-pica (12pt) first-line indent, no blank line between paragraphs — paragraphs are told apart by the indent.
  set par(justify: true, first-line-indent: 12pt, leading: 0.55em, spacing: 0.55em)

  // Block quotations
  set quote(block: true)
  show quote: set pad(x: 1em)
  show quote: set text(style: "italic")

  // Code — sized down for the narrow column, with wrap breakpoints so long space-less tokens (URLs, IN-lists) break instead of overflowing.
  show raw: set text(fill: rgb("#116611"), size: 0.8em)
  show raw: set block(inset: (left: 1em, top: 0.4em, right: 0.4em, bottom: 0.4em))
  show raw.where(block: true): set par(leading: 0.5em, spacing: 0.5em)
  show raw.where(block: true): it => {
    show regex(","): m => m.text + "​"
    it
  }
  show raw.where(block: false): it => {
    show regex("[-_./:]"): m => m.text + "​"
    it
  }

  // Tables — tighter for the column
  set table(inset: 4pt, stroke: 0.5pt + gray)
  show table: set text(size: 9pt)
  show table.cell.where(y: 0): set text(weight: "bold")

  // Footnotes
  set footnote.entry(indent: 0.5em)
  show footnote.entry: set par(hanging-indent: 1em)
  show footnote.entry: set text(size: 8pt)

  // Links
  show link: set text(fill: navy)

  // Headings — IEEE: numbered (period after the number), one blank line before and after, flush left, initially capitalized. Tight internal leading keeps a wrapped heading reading as a single title.
  set heading(numbering: "1.1.")
  show heading: set text(hyphenate: false)
  show heading.where(level: 1): it => block(above: 1em, below: 1em, {
    set text(size: 12pt, weight: "bold")
    set par(leading: 0.4em, first-line-indent: 0pt)
    it
  })
  show heading.where(level: 2): it => block(above: 1em, below: 1em, {
    set text(size: 11pt, weight: "bold")
    set par(leading: 0.4em, first-line-indent: 0pt)
    it
  })
  // Third order and deeper are "discouraged" by IEEE; kept compact and bound to the text that follows.
  show heading.where(level: 3): it => block(above: 1em, below: 0.4em, {
    set text(size: 10pt, weight: "bold")
    set par(leading: 0.4em, first-line-indent: 0pt)
    it
  })
  show heading.where(level: 4): it => block(above: 0.8em, below: 0.4em, {
    set text(size: 10pt, weight: "bold", style: "italic")
    set par(leading: 0.4em, first-line-indent: 0pt)
    it
  })
  show heading.where(level: 5): it => block(above: 0.8em, below: 0.4em, {
    set text(size: 10pt, weight: "regular", style: "italic")
    set par(leading: 0.4em, first-line-indent: 0pt)
    it
  })
  show heading.where(level: 6): it => block(above: 0.8em, below: 0.4em, {
    set text(size: 10pt, weight: "regular", style: "italic")
    set par(leading: 0.4em, first-line-indent: 0pt)
    it
  })

  // Cover — the title/authors/date get a full page of their own, single column, unnumbered.
  if title != none {
    page(paper: paper, margin: margins, footer: none)[
      #set align(center + horizon)
      #block(width: 100%, {
        set par(first-line-indent: 0pt, leading: 0.6em)
        text(size: 20pt, weight: "bold", title)
        if authors.len() > 0 {
          linebreak()
          v(1em)
          text(size: 14pt, authors.map(a => a.name).join(", "))
        }
        if date != none {
          linebreak()
          v(0.6em)
          text(size: 12pt, date)
        }
      })
    ]
  }

  // Table of contents (toc frontmatter flag) on its own page, single column, unnumbered.
  if toc {
    page(paper: paper, margin: margins, footer: none)[
      #outline(title: [Contents], depth: 3, indent: auto)
    ]
  }

  // Body page numbers start at 1 (cover and TOC are front matter).
  counter(page).update(1)

  // Two-column body — the verified gutter yields the exact IEEE column width.
  columns(2, gutter: gutter, doc)
}
