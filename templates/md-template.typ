// Adapted from Letter-size Pandoc-Typst layout template
// by John Maxwell, jmax@sfu.ca, July 2024
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


// Pandoc/markdown HR treatment
// display as a blank white section break
// I bet you can figure out how to make it a different colour!


// Resources:
// - https://neilzone.co.uk/2025/01/using-pandoc-and-typst-to-convert-markdown-into-custom-formatted-pdfs-with-a-sample-template/
// - https://imaginarytext.ca/posts/2024/pandoc-typst-tutorial/

#let horizontalrule = [
  #v(1pt)
  #line(start: (25%,0%), end: (75%,0%), stroke: 1pt + white)
  #v(1pt)
]


// MAIN CONF - this block goes almost to the end of this file

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
        if counter(page).at(here()).first() > 1 [    // after page 1
           #set text(size: 10pt, style: "italic")
           #align(right)[#title]
        ]
    },
    footer-descent: 30%, //30 is default
    footer:  // A running footer: page numbers
      context {
        if counter(page).at(here()).first() > 0 [     // all pages
          #set text(size: 10pt)
            #align(right)[#counter(page).display("1")]
          ]
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
  set image(width: 5.25in, fit: "contain")
  show image: it => {
    align(center, it)
  }
  set figure(gap: 0.5em, supplement: none)
  show figure.caption: set text(size: 9pt)

// Code snippets:
//
  show raw: set block(inset: (left: 2em, top: 0.5em, right: 1em, bottom: 0.5em ))
  show raw: set text(fill: rgb("#116611"), size: 9pt) //green


// Footnote formatting
//
  set footnote.entry(indent: 0.5em)
  show footnote.entry: set par(hanging-indent: 1em)
  show footnote.entry: set text(size: 10pt)



// HEADINGS
//
  show heading: set text(hyphenate: false)

  show heading.where(level: 1
    ):  it => align(left, block(above: 1.5em, below: 1.5em, width: 80% )[
        #set par(leading: 5em)
        #set text(font: font, weight: "semibold", size: 14pt)
        #block(it.body)
      ])

  show heading.where(level: 2
    ): it => align(left, block(above: 1.3em, below: 1.3em, width: 80%)[
        #set text(font: font, weight: "semibold", size: 12pt)
        #block(it.body)
      ])

  show heading.where(level: 3
    ): it => align(left, block(above: 1.3em, below: 1.3em)[
        #set text(font: font, weight: "regular", style: "italic", size: 11pt)
        #block(it.body)
      ])

// URLs
//

  show link: underline
  show link: set text(fill: navy)

// ============================================

// HERE'S THE DOCUMENT LAYOUT


// THIS IS THE TITLE/METADATA BLOCK
// v is for vertical spacing
//

v(10pt)
align(right, text(size: 20pt)[Your name])
  v(1em)
  align(left, text(size: 20pt)[
    #set par(justify: false)
    #title])
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
//v(1fr)
//line(start: (30%,0%), end: (70%,0%), stroke: 0.5pt + gray)
//align(center, text(size: 8pt, style: "italic")[For any questions relating to this, please email #email.])


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
