// The toolbar's "Try the showcase" pairs a document with a theme id. Neither failure below is
// visible at runtime: an id no theme answers to leaves the picker on no selection, and a text
// import that resolves to nothing loads a blank document over the user's own.
import { describe, it, expect } from "bun:test";
import { SHOWCASE } from "../src/showcase";
import { themes } from "../src/themes";

describe("showcase", () => {
  it("names a theme that exists", () => {
    expect(themes.map((t) => t.id)).toContain(SHOWCASE.themeId);
  });

  it("carries the document the README renders, not an empty import", () => {
    expect(SHOWCASE.markdown).toContain("title: Report Template Showcase");
    expect(SHOWCASE.markdown.length).toBeGreaterThan(5000);
  });

  it("uses the conventions the theme reads, so the pairing is worth making", () => {
    expect(SHOWCASE.markdown).toContain("| Severity | Critical |");
    expect(SHOWCASE.markdown).toContain("```mermaid");
  });
});
