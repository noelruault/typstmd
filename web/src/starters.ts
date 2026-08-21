// Preambles, not copied theme code: the package is fetched at its pinned version, so the rendering stays upstream's and every parameter of it stays reachable by the user.

export interface Starter {
  id: string;
  name: string;
  /** `name:version`, resolved by the package registry. */
  spec: string;
  /** The import and show rule; everything below it comes from the Markdown body. */
  preamble: string;
}

export const starters: Starter[] = [
  {
    id: "basic-resume",
    name: "Universe: basic-resume",
    spec: "basic-resume:0.2.9",
    preamble: `#import "@preview/basic-resume:0.2.9": *

#show: resume.with(
  author: "Your Name",
  location: "City, Country",
  email: "you@example.com",
  github: "github.com/you",
  linkedin: "linkedin.com/in/you",
  personal-site: "example.com",
  accent-color: "#26428b",
  font: "Libertinus Serif",
  paper: "a4",
)
`,
  },
  {
    id: "charged-ieee",
    name: "Universe: charged-ieee",
    spec: "charged-ieee:0.1.4",
    preamble: `#import "@preview/charged-ieee:0.1.4": ieee

#show: ieee.with(
  title: [A Paper Title],
  abstract: [
    One paragraph summarising the work.
  ],
  authors: (
    (
      name: "Your Name",
      department: [Department],
      organization: [Organisation],
      location: [City, Country],
      email: "you@example.com",
    ),
  ),
  index-terms: ("First term", "Second term"),
  paper-size: "a4",
)
`,
  },
  {
    id: "graceful-genetics",
    name: "Universe: graceful-genetics (Oxford masthead)",
    spec: "graceful-genetics:0.2.0",
    // `make-venue` in the package's own src/impl.typ hardcodes the masthead with no parameter, so no preamble can change it.
    preamble: `// This package prints a fixed "OXFORD PHYSICS" masthead and exposes no option for it.
#import "@preview/graceful-genetics:0.2.0" as graceful-genetics

#show: graceful-genetics.template.with(
  title: [A Paper Title],
  authors: (
    (
      name: "Your Name",
      department: "Department",
      institution: "Institution",
      city: "City",
      country: "Country",
      mail: "you@example.com",
    ),
  ),
  date: (year: 2026, month: "August", day: 21),
  keywords: ("first", "second"),
  abstract: [
    One paragraph summarising the work.
  ],
)
`,
  },
  {
    id: "dashing-dept-news",
    name: "Universe: dashing-dept-news",
    spec: "dashing-dept-news:0.1.1",
    preamble: `#import "@preview/dashing-dept-news:0.1.1": newsletter, article

#show: newsletter.with(
  title: [Department Newsletter],
  edition: [
    Month 1st, 2026 \\
    Your College
  ],
  publication-info: [
    The Dean of the Department. \\
    #link("mailto:you@example.com")
  ],
)
`,
  },
];

export function getStarter(id: string): Starter | undefined {
  return starters.find((s) => s.id === id);
}
