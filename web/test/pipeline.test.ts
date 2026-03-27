import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { markdownToTypst } from "../src/pipeline";

describe("pipeline integration", () => {
  it("produces valid Typst source from simple markdown", () => {
    const result = markdownToTypst("# Hello\n\nWorld.");
    expect(result.typstSource).toContain("#let conf(");
    expect(result.typstSource).toContain("= Hello");
    expect(result.typstSource).toContain("World.");
    expect(result.warnings).toHaveLength(0);
  });

  it("includes theme template in output", () => {
    const result = markdownToTypst("# Test", { themeId: "default" });
    expect(result.typstSource).toContain("#let conf(");
    expect(result.typstSource).toContain("#show: doc => conf(doc)");
  });

  it("includes frontmatter metadata", () => {
    const md = "---\ntitle: My Doc\nauthor: Alice\ndate: 2025-01-01\n---\n\n# Content";
    const result = markdownToTypst(md);
    expect(result.typstSource).toContain("title: [My Doc]");
    expect(result.typstSource).toContain("(name: [Alice]),");
    expect(result.typstSource).toContain("date: [2025-01-01]");
  });

  it("collects warnings for unsupported nodes", () => {
    const md = "<div>html</div>";
    const result = markdownToTypst(md);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.nodeType === "html")).toBe(true);
  });

  it("switches themes", () => {
    const md = "# Hello";
    const def = markdownToTypst(md, { themeId: "default" });
    const min = markdownToTypst(md, { themeId: "minimal" });
    const acad = markdownToTypst(md, { themeId: "academic" });

    // All produce different templates but same body
    expect(def.typstSource).toContain("= Hello");
    expect(min.typstSource).toContain("= Hello");
    expect(acad.typstSource).toContain("= Hello");

    // Templates differ
    expect(def.typstSource).not.toBe(min.typstSource);
    expect(def.typstSource).not.toBe(acad.typstSource);
  });

  it("handles example.md end-to-end without crashing", () => {
    const examplePath = join(import.meta.dir, "../../example.md");
    const md = readFileSync(examplePath, "utf-8");
    const result = markdownToTypst(md);

    // Should produce non-empty Typst source
    expect(result.typstSource.length).toBeGreaterThan(500);
    // Should contain template + body
    expect(result.typstSource).toContain("#let conf(");
    expect(result.typstSource).toContain("= h1 Heading");
    expect(result.typstSource).toContain("== h2 Heading");
    // Tables from example.md
    expect(result.typstSource).toContain("#table(columns:");
    // Footnotes from example.md
    expect(result.typstSource).toContain("#footnote[");

    // Warnings for remaining unsupported/edge-case nodes.
    // Images and strikethrough are now supported (no warnings).
    // imageReference with definitions is now resolved (no warning).
    const warnTypes = result.warnings.map((w) => w.nodeType);
    expect(warnTypes).toContain("table");          // alignment metadata warning
  });

  it("warns on zero supported syntax that is silently dropped", () => {
    // Every node type that produces output should NOT generate a warning.
    // This test ensures supported syntax doesn't accidentally trigger warnings.
    const md = [
      "# Heading",
      "",
      "Paragraph with **bold** and *italic*.",
      "",
      "`inline code`",
      "",
      "```js",
      "code block",
      "```",
      "",
      "[link](https://example.com)",
      "",
      "> blockquote",
      "",
      "---",
      "",
      "- list",
      "",
      "1. ordered",
      "",
      "| A |",
      "|---|",
      "| 1 |",
      "",
      "Text[^1]",
      "",
      "[^1]: Note",
      "",
      "~~strikethrough~~",
      "",
      "H~2~O and 19^th^",
      "",
      "==highlighted==",
    ].join("\n");

    const result = markdownToTypst(md);
    expect(result.warnings).toHaveLength(0);
  });
});
