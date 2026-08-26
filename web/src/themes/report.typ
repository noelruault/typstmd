#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  toc: false,
  font: "Arimo",
  fontsize: 10pt,
  // typstmd passes only the parameters above; edit these to brand a report.
  subtitle: none,
  brand: "Security Report",
  classification: none,
  doc,
) = {
  let ink = rgb("#1a1a1a")
  let muted = rgb("#6b6b6b")
  let rule = rgb("#c7c7c7")
  let charcoal = rgb("#3b3c3d")
  let table-head = rgb("#3d3c4f")
  let card = rgb("#f7f7f8")
  let mono-font = "DejaVu Sans Mono"

  // Sampled from the reference report so a severity reads the same at a glance.
  let severities = (
    "critical": (fill: rgb("#f73b3b"), ink: white),
    "high": (fill: rgb("#ff7070"), ink: white),
    "medium": (fill: rgb("#fea116"), ink: rgb("#3a2a00")),
    "low": (fill: rgb("#ffe23d"), ink: rgb("#3a3200")),
    "informational": (fill: rgb("#75cfff"), ink: rgb("#00293a")),
    "unknown": (fill: rgb("#d9d9d9"), ink: rgb("#5b5b5b")),
  )

  let badge(label) = {
    let key = lower(label)
    let style = severities.at(key, default: none)
    if style == none {
      label
    } else {
      box(
        fill: style.fill,
        radius: 3pt,
        inset: (x: 6pt, y: 3pt),
        text(size: 0.85em, weight: "semibold", fill: style.ink)[#label],
      )
    }
  }

  // A pill is only substituted when a cell says nothing but the severity, so ordinary prose that happens to contain "high" is untouched.
  let as-plain-text(it) = {
    if type(it) == str {
      it
    } else if it.has("text") {
      it.text
    } else if it.has("children") {
      // join returns none for an empty array, and an empty table cell is exactly that.
      let joined = it.children.map(as-plain-text).join("")
      if joined == none { "" } else { joined }
    } else if repr(it.func()) == "space" {
      " "
    } else {
      ""
    }
  }

  set page(
    paper: "us-letter",
    margin: (x: 1.15in, top: 1.1in, bottom: 1in),
    footer: context {
      if counter(page).at(here()).first() > 0 [
        #set text(size: 8.5pt, fill: muted)
        #align(center)[#counter(page).display("1")]
      ]
    },
  )

  set text(lang: lang, font: font, size: fontsize, fill: ink)
  set par(leading: 0.9em, spacing: 1.5em, justify: true)
  show link: set text(fill: rgb("#1a4fbf"))

  // Code
  show raw: set text(font: mono-font, size: 0.85em)
  show raw.where(block: true): set par(leading: 0.6em, spacing: 0.6em)
  show raw.where(block: true): set block(inset: (left: 0.6em, y: 0.4em))
  show raw.where(block: true): it => {
    show regex(","): m => m.text + "​"
    it
  }
  show raw.where(block: false): it => {
    show regex("[-_./:]"): m => m.text + "​"
    it
  }

  // Headings: a section title over a heavy rule, as in the reference report.
  show heading.where(level: 1): it => block(above: 2.4em, below: 1.1em, width: 100%)[
    #set text(size: 19pt, weight: "regular")
    #set par(leading: 0.75em, justify: false)
    #it.body
    #v(4pt, weak: true)
    #line(length: 100%, stroke: 1.6pt + ink)
  ]

  show heading.where(level: 2): it => block(above: 2.2em, below: 1em)[
    #set text(size: 13pt, weight: "regular")
    #set par(leading: 0.8em, justify: false)
    #it.body
  ]

  show heading.where(level: 3): it => block(above: 1.8em, below: 0.9em)[
    #set text(size: 11pt, weight: "bold")
    #set par(leading: 0.8em, justify: false)
    #it.body
  ]

  show heading.where(level: 4): it => block(above: 1.6em, below: 0.8em)[
    #set text(size: 10pt, weight: "bold", fill: muted)
    #it.body
  ]

  // Quotes read as callouts in a report.
  set quote(block: true)
  show quote: it => block(
    width: 100%,
    fill: card,
    stroke: (left: 2pt + charcoal),
    inset: (x: 1em, y: 0.8em),
    it.body,
  )

  // Tables: three or more columns is a data table with a dark header; two columns is a metadata card, which is how each finding lists its ID, severity and status.
  // Fill and strokes must be set before any table is realised: a set rule inside a table's own show rule cannot restyle that table. Row 0 is the header band; the metadata card hides it.
  set table(
    inset: (x: 8pt, y: 7pt),
    // horizon so a severity pill sits on the row's centre line beside its label, not floating at the top of a tall wrapped cell.
    align: left + horizon,
    fill: (_, y) => if y == 0 { table-head },
    stroke: (_, y) => if y > 1 { (top: 0.5pt + rule) },
  )
  show table.cell: it => {
    let plain = as-plain-text(it.body).trim()
    // Rebuild the cell so the badge inherits the row's vertical centring; a bare box would sit at the top of a tall row. The rebuilt cell's body is a box, so this show rule re-enters once, finds no severity word, and stops.
    if severities.keys().contains(lower(plain)) { table.cell(align: horizon, badge(plain)) } else { it }
  }

  show table: it => {
    let columns = if type(it.columns) == array { it.columns.len() } else { it.columns }
    if columns == 2 {
      block(width: 100%, fill: card, radius: 4pt, inset: (x: 10pt, y: 8pt), {
        set text(size: 0.95em)
        // GFM demands a header row; a metadata card has nothing to put in it.
        show table.cell.where(y: 0): none
        show table.cell.where(x: 0): set text(fill: muted)
        it
      })
    } else {
      block(width: 100%, {
        set text(size: 0.95em)
        show table.cell.where(y: 0): set text(fill: white, weight: "bold")
        it
      })
    }
  }

  // A severity word standing alone as strong text becomes a pill too, for prose legends.
  show strong: it => {
    let plain = as-plain-text(it.body).trim()
    if severities.keys().contains(lower(plain)) { badge(plain) } else { it }
  }

  set list(marker: [•], indent: 0.6em, body-indent: 0.5em, spacing: 0.9em)
  set enum(indent: 0.6em, body-indent: 0.5em, spacing: 0.9em)

  // Cover page
  if title != none {
    page(footer: none, margin: 0pt, fill: rgb("#fbfbfd"))[
      #place(top + left, dx: 0pt, dy: 0pt, rect(
        width: 100%,
        height: 100%,
        fill: gradient.linear(rgb("#f4f6fb"), rgb("#f7f0f6"), rgb("#fbfbfd"), angle: 35deg),
      ))
      #place(top + right, dx: -0.9in, dy: 1.5in, circle(radius: 52pt, stroke: 0.7pt + rgb("#c9b6e8")))
      #place(top + left, dx: 1.1in, dy: 2.4in, circle(radius: 38pt, stroke: 0.7pt + rgb("#f0b9c8")))
      #place(bottom + left, dx: 1.3in, dy: -1.5in, circle(radius: 46pt, stroke: 0.7pt + rgb("#bfe3d8")))
      #place(top + left, dx: 2.2in, dy: 1.1in, line(length: 1.6in, angle: 38deg, stroke: 0.7pt + rgb("#b9c4f0")))
      #place(bottom + right, dx: -1.4in, dy: -2.1in, line(length: 1.3in, angle: -52deg, stroke: 0.7pt + rgb("#c9b6e8")))

      #place(top + left, dx: 1.15in, dy: 4.6in)[
        #text(size: 15pt, weight: "bold")[#brand]
      ]
      #place(top + left, dx: 0pt, dy: 5.1in, block(
        width: 100%,
        fill: charcoal,
        inset: (x: 1.15in, y: 26pt),
      )[
        #set par(justify: false, leading: 0.7em)
        #text(size: 25pt, fill: white)[#title]
        #if subtitle != none [
          #v(0.5em)
          #text(size: 13pt, fill: rgb("#e4e4e6"))[#subtitle]
        ]
        #if date != none [
          #v(0.7em)
          #text(size: 9.5pt, fill: rgb("#c9c9cc"))[#date]
        ]
      ])

      #if authors.len() > 0 or classification != none [
        #place(bottom + left, dx: 1.15in, dy: -1in)[
          #set text(size: 9pt, fill: muted)
          #if authors.len() > 0 [#authors.map(a => a.name).join(", ")]
          #if classification != none [ \ #classification ]
        ]
      ]
    ]
  }

  counter(page).update(if title != none { 2 } else { 1 })

  if toc {
    set page(footer: context {
      if counter(page).at(here()).first() > 0 [
        #set text(size: 8.5pt, fill: muted)
        #align(center)[#counter(page).display("1")]
      ]
    })
    show outline.entry: set block(above: 1.4em)
    show outline.entry.where(level: 1): set text(size: 11pt)
    show outline.entry.where(level: 2): set text(size: 9pt, fill: rgb("#3a3a3a"))
    set outline.entry(fill: repeat(justify: false)[#text(fill: rule)[.]])
    // `title: auto` so the heading follows the document language; drawing the words here would pin it to English.
    // The outline emits its title as a level-1 heading, so this scoped rule restyles it in place.
    show heading.where(level: 1): it => block(above: 0pt, below: 1.2em, width: 100%)[
      #set text(size: 22pt, weight: "regular")
      #align(center)[#it.body]
    ]
    outline(title: auto, depth: 3, indent: 1.2em)
    pagebreak()
  }

  doc
}
