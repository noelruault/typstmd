// Adapted from Letter-size Pandoc-Typst layout template by John Maxwell, jmax@sfu.ca, July 2024
//
// This template is for Typst with Pandoc
// The assumption is markdown source, with a
// YAML metadata block (title, author, date...)
//
// Usage:
//      pandoc myMarkdownFile.txt \
//      --wrap=none \
//      --pdf-engine=typst \
//      --template=simplePandocTypst.template  \
//     -o myBeautifulPDF.pdf


// Pandoc/markdown HR treatment display as a blank white section break
// I bet you can figure out how to make it a different colour!

// Resources:
// - https://neilzone.co.uk/2025/01/using-pandoc-and-typst-to-convert-markdown-into-custom-formatted-pdfs-with-a-sample-template/
// - https://imaginarytext.ca/posts/2024/pandoc-typst-tutorial/

#let horizontalrule = [ v(1pt) line(start: (25%,0%), end: (75%,0%), stroke: 1pt + white) v(1pt)
]


// MAIN CONF - this block goes almost to the end of this file
// NOTE: keep all styling as SINGLE inline expressions, e.g. align(x, text(..)[..]), never "#set X" followed by another statement. A PostToolUse formatter joins lines and would break multi-statement blocks (Typst "expected semicolon"). Inline = safe.

#let conf(
// SET BASIC TEMPLATE DEFAULTS:
  title: none,
  subtitle: none,
  authors: ( (name: [Neil Brown]) ), // IF NOT IN METADATA
  date: datetime.today().display(),  // IF NOT IN METADATA
//  email: "email@example.com", //IF NOT IN METADATA
  venue: none,
  abstract: none,
  lang: "en",
  region: "GB",
  font: "Libertinus Serif", // https://typst.app/docs/reference/text/text/#parameters-font
  fontsize: 12pt,
  sectionnumbering: none,
  doc,
) = {
  set page(
    width: 210mm,
    height: 297mm,
    flipped: false,  // if true = flips to landscape format,
    margin: (left: 2.5cm, top: 2cm, right: 2.5cm, bottom: 2cm),

// Header and Footer
//
    header:  // A running head: document title
      context {
        if counter(page).at(here()).first() > 1 {
          align(right, text(size: 10pt, style: "italic")[#title])   // formatter-proof: single expr
        }
    },
    footer-descent: 30%, //30 is default
    footer:  // A running footer: page numbers
      context {
        if counter(page).at(here()).first() > 0 {
          align(right, text(size: 10pt)[#counter(page).display("1")])   // formatter-proof: single expr
        }
     },
)


// BASIC BODY PARAGRAPH FORMATTING
//
  set par(
    first-line-indent: 0em,
    leading: 1.3em,
    justify: false,
    spacing: 2em,
  )
// ALT PARAGRAPH STYLE, COMMENT PREV 6 LINES, and UNCOMMENT THESE:
// show par: set block(spacing: 18pt) // blank line between paragraphs
//  set par(
//    first-line-indent: 0em,
//    leading: 8pt,
//    justify: true,
//  )
  set text(lang: lang,
         font: font, // set on line 40 above
         size: fontsize,
         alternates: false,
)


// Block quotations
//
  set quote(block: true)
  show quote: set block(spacing: 2em)
  show quote: set pad(x: 2em)   // L&R margins
  show quote: set par(leading: 1.3em)
  show quote: set text(style: "italic")


// Images and figures:
//
  set image(width: 100%, fit: "contain")
  show image: it => {
    align(center, it)
  }
  set figure(gap: 0.5em, supplement: none)
  show figure.caption: set text(size: 9pt)

// Code snippets:
//
  show raw: set block(inset: (left: 2em, top: 0.5em, right: 1em, bottom: 0.5em ))
  show raw: set text(fill: rgb("#116611"), size: 9pt) //green
  // Match the web themes: tight code line-spacing, and a zero-width break after each comma so long
  // space-less numeric lists (e.g. SQL IN-lists) wrap instead of overflowing and opening a gap.
  show raw.where(block: true): set par(leading: 0.65em, spacing: 0.65em)
  show raw.where(block: true): it => { show regex(","): m => m.text + "\u{200B}"; it }
  show raw.where(block: false): it => { show regex("[-_./:]"): m => m.text + "\u{200B}"; it }


// Footnote formatting
//
  set footnote.entry(indent: 0.5em)
  show footnote.entry: set par(hanging-indent: 1em)
  show footnote.entry: set text(size: 10pt)



// HEADINGS
//
  show heading: set text(hyphenate: false)

  show heading.where(level: 1): it => align(left, block(above: 1.5em, below: 1em, width: 100%, text(font: font, weight: "semibold", size: 22pt, { show raw: set text(size: 1em); it.body })))

  show heading.where(level: 2): it => align(left, block(above: 1.3em, below: 0.8em, width: 100%, text(font: font, weight: "semibold", size: 17pt, { show raw: set text(size: 1em); it.body })))

  show heading.where(level: 3): it => align(left, block(above: 1.2em, below: 0.6em, text(font: font, weight: "semibold", size: 15pt, { show raw: set text(size: 1em); it.body })))

  show heading.where(level: 4): it => align(left, block(above: 1em, below: 0.5em, text(font: font, weight: "bold", size: 13pt, { show raw: set text(size: 1em); it.body })))

  show heading.where(level: 5): it => align(left, block(above: 1em, below: 0.5em, text(font: font, weight: "bold", size: 12pt, { show raw: set text(size: 1em); it.body })))

  show heading.where(level: 6): it => align(left, block(above: 1em, below: 0.5em, text(font: font, weight: "regular", style: "italic", size: 12pt, { show raw: set text(size: 1em); it.body })))

// Tables
//
  set table(inset: 8pt, stroke: 0.5pt + gray)
  show table.cell.where(y: 0): set text(weight: "semibold")
  show figure.where(kind: table): set figure.caption(position: top)
  // Figures do not break across pages by default, so a table taller than the remaining page overflows and rows overlap. Make table figures breakable.
  show figure.where(kind: table): set block(breakable: true)

// URLs
//

  show link: underline
  show link: set text(fill: navy)

// ============================================

// HERE'S THE DOCUMENT LAYOUT


// THIS IS THE TITLE/METADATA BLOCK v is for vertical spacing
//

v(10pt)
align(right, text(size: 20pt)[#authors.first().name])
  v(1em)
  align(left, text(size: 20pt, title))   // formatter-proof; global par is already justify:false
  v(2pt)
//  align(left, text(size: 16pt, style: "italic")[
//     #set par(first-line-indent: 0em, justify: false)
//     #subtitle])
//  v(3pt)
//  align(right, text(size: 11pt)[#authors.first().name (#email)])
//  v(3pt)
  align(left, text(size: 11pt)[#date])
  v(2pt)
  line(start: (0%,0%), end: (100%,0%), stroke: 1pt + gray)
  v(2pt)


// THIS IS THE ACTUAL BODY:

  counter(page).update(1) // start page numbering
  doc  // this is where the content goes

// COLOPHON at bottom of last page
//
//v(1fr) line(start: (30%,0%), end: (70%,0%), stroke: 0.5pt + gray) align(center, text(size: 8pt, style: "italic")[For any questions relating to this, please email #email.])


}  // end of #let conf block



// BOILERPLATE PANDOC TEMPLATE:
#show: doc => conf(
$if(title)$
  title: [$title$],
$endif$
$if(subtitle)$
  subtitle: [$subtitle$],
$endif$
$if(author)$
  authors: (
$for(author)$
$if(author.name)$
    ( name: [$author.name$],
      affiliation: [$author.affil$],
      email: [$author.email$] ),
$else$
    ( name: [$author$],
      affiliation: [],
      email: [] ),
$endif$
$endfor$
    ),
$endif$
$if(venue)$
  venue: [$venue$],
$endif$
$if(date)$
  date: [$date$],
$endif$
$if(lang)$
  lang: "$lang$",
$endif$
$if(region)$
  region: "$region$",
$endif$
$if(abstract)$
  abstract: [$abstract$],
$endif$
$if(margin)$
  margin: ($for(margin/pairs)$$margin.key$: $margin.value$,$endfor$),
$endif$
$if(papersize)$
  paper: "$papersize$",
$endif$
$if(section-numbering)$
  sectionnumbering: "$section-numbering$",
$endif$
  doc,
)

$if(toc)$
#outline(
  title: auto,
  depth: none
);
$endif$

$body$

$if(citations)$
$if(bibliographystyle)$

#set bibliography(style: "$bibliographystyle$")
$endif$
$if(bibliography)$

#bibliography($for(bibliography)$"$bibliography$"$sep$,$endfor$)
$endif$
$endif$
$for(include-after)$

$include-after$
$endfor$
