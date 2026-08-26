#let conf(
  title: none,
  authors: (),
  date: none,
  lang: "en",
  toc: false,
  font: "Barlow",
  fontsize: 10.5pt,
  // typstmd passes only the parameters above; edit these to brand a report.
  subtitle: none,
  classification: none,
  doc,
) = {
  // Sampled from the project avatar: violet ground, lime star, magenta and cyan trail.
  let violet = rgb("#6b51ff")
  let deep = rgb("#241a4d")
  let slate = rgb("#585273")
  let midslate = rgb("#9a93c4")
  let lightslate = rgb("#cfc7ff")
  let ultralight = rgb("#f1eeff")
  let ink = rgb("#2b2b33")
  let grey90 = rgb("#191919")
  let grey60 = rgb("#666666")
  let grey20 = rgb("#d5d0e8")
  let display-font = "Montserrat"
  let mono-font = "DejaVu Sans Mono"

  // Rectangles rather than an SVG <text> element: text inside an SVG resolves outside Typst's font book and falls back to Libertinus Serif however the family is named.
  // Aspect is 5.86:1, so give the image a width and let the height follow.
  let wordmark(width: 0.62in, fill: violet) = image(
    bytes(
      "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 4811.76 821.52\">"
        + "<path fill=\"" + fill.to-hex() + "\" d=\""
        + "M0.00 0.00 H586.80 V117.36 H0.00 Z M234.72 117.36 H352.08 V234.72 H234.72 Z M234.72 234.72 H352.08 V352.08 H234.72 Z M234.72 352.08 H352.08 V469.44 H234.72 Z M234.72 469.44 H352.08 V586.80 H234.72 Z M234.72 586.80 H352.08 V704.16 H234.72 Z M234.72 704.16 H352.08 V821.52 H234.72 Z"
        + " M704.16 0.00 H821.52 V117.36 H704.16 Z M1173.60 0.00 H1290.96 V117.36 H1173.60 Z M704.16 117.36 H821.52 V234.72 H704.16 Z M1173.60 117.36 H1290.96 V234.72 H1173.60 Z M821.52 234.72 H938.88 V352.08 H821.52 Z M1056.24 234.72 H1173.60 V352.08 H1056.24 Z M938.88 352.08 H1056.24 V469.44 H938.88 Z M938.88 469.44 H1056.24 V586.80 H938.88 Z M938.88 586.80 H1056.24 V704.16 H938.88 Z M938.88 704.16 H1056.24 V821.52 H938.88 Z"
        + " M1408.32 0.00 H1877.76 V117.36 H1408.32 Z M1408.32 117.36 H1525.68 V234.72 H1408.32 Z M1877.76 117.36 H1995.12 V234.72 H1877.76 Z M1408.32 234.72 H1525.68 V352.08 H1408.32 Z M1877.76 234.72 H1995.12 V352.08 H1877.76 Z M1408.32 352.08 H1877.76 V469.44 H1408.32 Z M1408.32 469.44 H1525.68 V586.80 H1408.32 Z M1408.32 586.80 H1525.68 V704.16 H1408.32 Z M1408.32 704.16 H1525.68 V821.52 H1408.32 Z"
        + " M2112.48 0.00 H2699.28 V117.36 H2112.48 Z M2112.48 117.36 H2229.84 V234.72 H2112.48 Z M2112.48 234.72 H2229.84 V352.08 H2112.48 Z M2112.48 352.08 H2699.28 V469.44 H2112.48 Z M2581.92 469.44 H2699.28 V586.80 H2581.92 Z M2581.92 586.80 H2699.28 V704.16 H2581.92 Z M2112.48 704.16 H2699.28 V821.52 H2112.48 Z"
        + " M2816.64 0.00 H3403.44 V117.36 H2816.64 Z M3051.36 117.36 H3168.72 V234.72 H3051.36 Z M3051.36 234.72 H3168.72 V352.08 H3051.36 Z M3051.36 352.08 H3168.72 V469.44 H3051.36 Z M3051.36 469.44 H3168.72 V586.80 H3051.36 Z M3051.36 586.80 H3168.72 V704.16 H3051.36 Z M3051.36 704.16 H3168.72 V821.52 H3051.36 Z"
        + " M3520.80 0.00 H3638.16 V117.36 H3520.80 Z M3990.24 0.00 H4107.60 V117.36 H3990.24 Z M3520.80 117.36 H3755.52 V234.72 H3520.80 Z M3872.88 117.36 H4107.60 V234.72 H3872.88 Z M3520.80 234.72 H3638.16 V352.08 H3520.80 Z M3755.52 234.72 H3872.88 V352.08 H3755.52 Z M3990.24 234.72 H4107.60 V352.08 H3990.24 Z M3520.80 352.08 H3638.16 V469.44 H3520.80 Z M3990.24 352.08 H4107.60 V469.44 H3990.24 Z M3520.80 469.44 H3638.16 V586.80 H3520.80 Z M3990.24 469.44 H4107.60 V586.80 H3990.24 Z M3520.80 586.80 H3638.16 V704.16 H3520.80 Z M3990.24 586.80 H4107.60 V704.16 H3990.24 Z M3520.80 704.16 H3638.16 V821.52 H3520.80 Z M3990.24 704.16 H4107.60 V821.52 H3990.24 Z"
        + " M4224.96 0.00 H4694.40 V117.36 H4224.96 Z M4224.96 117.36 H4342.32 V234.72 H4224.96 Z M4694.40 117.36 H4811.76 V234.72 H4694.40 Z M4224.96 234.72 H4342.32 V352.08 H4224.96 Z M4694.40 234.72 H4811.76 V352.08 H4694.40 Z M4224.96 352.08 H4342.32 V469.44 H4224.96 Z M4694.40 352.08 H4811.76 V469.44 H4694.40 Z M4224.96 469.44 H4342.32 V586.80 H4224.96 Z M4694.40 469.44 H4811.76 V586.80 H4694.40 Z M4224.96 586.80 H4342.32 V704.16 H4224.96 Z M4694.40 586.80 H4811.76 V704.16 H4694.40 Z M4224.96 704.16 H4694.40 V821.52 H4224.96 Z"
        + "\"/></svg>",
    ),
    format: "svg",
    width: width,
  )

  // Severity pill = a tint of the hue under bold coloured text, not a solid fill.
  // The hues come from the avatar rather than a traffic-light scale, so the order reads magenta → violet → cyan → mint rather than red → green.
  let severities = (
    "critical":      (bg: rgb("#ffe2fb"), ink: rgb("#a3008c")),
    "high":          (bg: rgb("#ece7ff"), ink: rgb("#4b2ede")),
    "medium":        (bg: rgb("#dff1ff"), ink: rgb("#0a5f9e")),
    "low":           (bg: rgb("#e2fae7"), ink: rgb("#2f7a45")),
    "informational": (bg: rgb("#f1eeff"), ink: rgb("#585273")),
    "unknown":       (bg: rgb("#eaeaea"), ink: rgb("#666666")),
  )

  let badge(label) = {
    let key = lower(label)
    let style = severities.at(key, default: none)
    if style == none {
      label
    } else {
      box(
        fill: style.bg,
        radius: 4pt,
        inset: (x: 8pt, y: 3pt),
        text(size: 0.82em, weight: "bold", fill: style.ink)[#label],
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

  let page-footer = context {
    if counter(page).at(here()).first() > 0 [
      #line(length: 100%, stroke: 0.5pt + grey20)
      #v(2pt)
      #grid(
        columns: (1fr, auto),
        align: horizon,
        wordmark(width: 0.62in),
        text(font: font, size: 8.5pt, fill: slate)[#counter(page).display("1")],
      )
    ]
  }

  set page(paper: "us-letter", margin: (x: 1.15in, top: 1.1in, bottom: 1in), footer: page-footer)

  set text(lang: lang, font: font, size: fontsize, fill: ink)
  set par(leading: 0.9em, spacing: 1.4em, justify: false)
  show link: set text(fill: violet)

  // Code
  show raw: set text(font: mono-font, size: 0.8em, fill: slate)
  show raw.where(block: true): set par(leading: 0.6em, spacing: 0.6em)
  show raw.where(block: true): it => block(
    width: 100%,
    fill: ultralight,
    radius: 4pt,
    inset: (x: 0.9em, y: 0.7em),
    {
      show regex(","): m => m.text + "​"
      it
    },
  )
  show raw.where(block: false): it => {
    show regex("[-_./:]"): m => m.text + "​"
    it
  }

  // Headings: display-face title over the violet rule; sub-heads in the body face.
  show heading.where(level: 1): it => block(above: 2.4em, below: 1.1em, width: 100%)[
    #set text(font: display-font, weight: 800, size: 18pt, fill: grey90)
    #set par(leading: 0.9em, justify: false)
    #it.body
    #v(5pt, weak: true)
    #line(length: 100%, stroke: 2pt + violet)
  ]

  show heading.where(level: 2): it => block(above: 2.1em, below: 0.9em)[
    #set text(size: 14pt, weight: "bold", fill: grey90)
    #set par(leading: 0.85em, justify: false)
    #it.body
  ]

  show heading.where(level: 3): it => block(above: 1.7em, below: 0.8em)[
    #set text(size: 11.5pt, weight: "bold", fill: slate)
    #set par(leading: 0.85em, justify: false)
    #it.body
  ]

  show heading.where(level: 4): it => block(above: 1.5em, below: 0.7em)[
    #set text(size: 10pt, weight: "bold", fill: grey60)
    #it.body
  ]

  // Quotes read as callouts: a violet-tinted card with an accent edge.
  set quote(block: true)
  show quote: it => block(
    width: 100%,
    fill: ultralight,
    stroke: (left: 3pt + violet),
    radius: (right: 4pt),
    inset: (x: 1em, y: 0.8em),
    it.body,
  )

  // Tables: three or more columns is a data table with the deep-violet header band; two columns is a metadata card.
  // Fill and strokes must be set before any table is realised: a set rule inside a table's own show rule cannot restyle that table. The header band is fill-only (no stroke), so it collapses invisibly when the metadata card hides row 0.
  set table(
    inset: (x: 10pt, y: 7pt),
    // horizon so a severity pill sits on the row's centre line beside its label, not floating at the top of a tall wrapped cell.
    align: left + horizon,
    fill: (_, y) => if y == 0 { deep },
    stroke: (_, y) => if y > 1 { (top: 0.6pt + grey20) },
  )
  show table.cell: it => {
    let plain = as-plain-text(it.body).trim()
    // Rebuild the cell so the badge inherits the row's vertical centring; a bare box would sit at the top of a tall row. The rebuilt cell's body is a box, so this show rule re-enters once, finds no severity word, and stops.
    if severities.keys().contains(lower(plain)) { table.cell(align: horizon, badge(plain)) } else { it }
  }

  show table: it => {
    let columns = if type(it.columns) == array { it.columns.len() } else { it.columns }
    if columns == 2 {
      block(width: 100%, fill: ultralight, radius: 6pt, stroke: 0.75pt + lightslate, inset: (x: 12pt, y: 10pt), {
        set text(size: 0.95em)
        // GFM demands a header row; a metadata card has nothing to put in it.
        show table.cell.where(y: 0): none
        show table.cell.where(x: 0): set text(fill: slate)
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

  // Cover page: deep-violet title band with a display-face headline over the accent rule.
  if title != none {
    page(footer: none, margin: 0pt, fill: white)[
      #place(top + left, dx: 1.15in, dy: 1.2in, wordmark(width: 1.6in))
      #place(top + left, dx: 1.15in, dy: 1.66in, line(length: 0.7in, stroke: 2.5pt + violet))

      #place(top + left, dx: 0pt, dy: 4.3in, block(
        width: 100%,
        fill: deep,
        inset: (x: 1.15in, y: 36pt),
      )[
        #set par(justify: false, leading: 0.8em)
        #text(font: display-font, weight: 800, size: 30pt, fill: white)[#title]
        #v(12pt)
        #line(length: 1.1in, stroke: 2.5pt + violet)
        #if subtitle != none [
          #v(12pt)
          #text(size: 14pt, fill: lightslate)[#subtitle]
        ]
        #if date != none [
          #v(7pt)
          #text(size: 10pt, fill: midslate)[#date]
        ]
      ])

      #if authors.len() > 0 or classification != none [
        #place(bottom + left, dx: 1.15in, dy: -1in)[
          #set text(size: 9pt, fill: slate)
          #if authors.len() > 0 [#authors.map(a => a.name).join(", ")]
          #if classification != none [ \ #classification ]
        ]
      ]
    ]
  }

  counter(page).update(if title != none { 2 } else { 1 })

  if toc {
    set page(footer: page-footer)
    show outline.entry: set block(above: 1.4em)
    show outline.entry.where(level: 1): set text(size: 11pt, fill: grey90)
    show outline.entry.where(level: 2): set text(size: 9pt, fill: slate)
    set outline.entry(fill: repeat(justify: false)[#text(fill: grey20)[.]])
    // `title: auto` so the heading follows the document language; drawing the word here would pin it to English.
    // The outline emits its title as a level-1 heading, so this scoped rule restyles it without the section rule's top margin.
    show heading.where(level: 1): it => block(above: 0pt, below: 1.2em, width: 100%)[
      #set text(font: display-font, weight: 800, size: 20pt, fill: grey90)
      #it.body
      #v(5pt, weak: true)
      #line(length: 100%, stroke: 2pt + violet)
    ]
    outline(title: auto, depth: 3, indent: 1.2em)
    pagebreak()
  }

  doc
}
