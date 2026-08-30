// The showcase is a document and a theme together, not a document alone: it is written to the
// typstmd theme's conventions (a two-column table is a metadata card, a lone severity word is a
// pill, three or more columns get the dark header band), so loading it under any other template
// renders none of what it is there to show.
//
// The markdown is the fixture behind the README animation, imported rather than copied, so the
// showcase the app offers and the pages the README shows cannot drift apart.
import markdown from "../test/visuals/branded-report.md" with { type: "text" };

export const SHOWCASE = {
  themeId: "typstmd",
  markdown: markdown.trim(),
} as const;
