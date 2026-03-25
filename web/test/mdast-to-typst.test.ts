import { describe, it, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { mdastToTypst } from "../src/mdast-to-typst";
import { createWarningCollector } from "../src/warnings";

/** Parse markdown to MDAST and serialize to Typst body (no template) */
function toTypst(md: string): string {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  const warnings = createWarningCollector();
  return mdastToTypst(tree, { warnings });
}

function getWarnings(md: string) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  const warnings = createWarningCollector();
  mdastToTypst(tree, { warnings });
  return warnings.getWarnings();
}

describe("headings", () => {
  it("renders h1", () => {
    expect(toTypst("# Title")).toBe("= Title");
  });

  it("renders h2", () => {
    expect(toTypst("## Subtitle")).toBe("== Subtitle");
  });

  it("renders h3", () => {
    expect(toTypst("### Section")).toBe("=== Section");
  });

  it("normalizes h4-h6 to h3", () => {
    expect(toTypst("#### Deep")).toBe("=== Deep");
    expect(toTypst("##### Deeper")).toBe("=== Deeper");
    expect(toTypst("###### Deepest")).toBe("=== Deepest");
  });
});

describe("paragraphs", () => {
  it("renders plain text", () => {
    expect(toTypst("Hello world")).toBe("Hello world");
  });

  it("separates paragraphs with double newline", () => {
    expect(toTypst("First\n\nSecond")).toBe("First\n\nSecond");
  });
});

describe("emphasis and strong", () => {
  it("renders strong", () => {
    expect(toTypst("**bold**")).toBe("*bold*");
  });

  it("renders emphasis", () => {
    expect(toTypst("*italic*")).toBe("_italic_");
  });

  it("renders nested strong in emphasis", () => {
    expect(toTypst("*text **bold** text*")).toBe("_text *bold* text_");
  });
});

describe("inline code", () => {
  it("renders inline code", () => {
    expect(toTypst("`code`")).toBe("`code`");
  });

  it("does not escape inside code", () => {
    expect(toTypst("`#hash @at $dollar`")).toBe("`#hash @at $dollar`");
  });
});

describe("code blocks", () => {
  it("renders fenced code block", () => {
    expect(toTypst("```\nhello\n```")).toBe("```\nhello\n```");
  });

  it("renders fenced code block with language", () => {
    expect(toTypst("```js\nconst x = 1;\n```")).toBe(
      "```js\nconst x = 1;\n```",
    );
  });
});

describe("links", () => {
  it("renders a link", () => {
    expect(toTypst("[text](https://example.com)")).toBe(
      '#link("https://example.com")[text]',
    );
  });

  it("escapes special chars in link URL", () => {
    expect(toTypst('[text](https://example.com/a"b)')).toBe(
      '#link("https://example.com/a\\"b")[text]',
    );
  });
});

describe("thematic breaks", () => {
  it("renders horizontal rule", () => {
    expect(toTypst("---")).toBe("#horizontalrule");
  });
});

describe("hard breaks", () => {
  it("renders hard break with backslash", () => {
    const result = toTypst("line one\\\nline two");
    expect(result).toContain("\\\n");
  });
});

describe("blockquotes", () => {
  it("renders a blockquote", () => {
    expect(toTypst("> quoted text")).toBe(
      "#quote(block: true)[quoted text]",
    );
  });
});

describe("escaping", () => {
  it("escapes Typst special characters in text", () => {
    const result = toTypst("Price is #5 and @mention");
    expect(result).toContain("\\#5");
    expect(result).toContain("\\@mention");
  });
});

describe("unsupported nodes", () => {
  it("warns on images", () => {
    const w = getWarnings("![alt](http://img.png)");
    expect(w.some((w) => w.nodeType === "image")).toBe(true);
  });

  it("renders image placeholder", () => {
    expect(toTypst("![alt text](http://img.png)")).toContain(
      "\\[Image: alt text\\]",
    );
  });

  it("warns on HTML", () => {
    const w = getWarnings("<div>html</div>");
    expect(w.some((w) => w.nodeType === "html")).toBe(true);
  });

  it("renders HTML placeholder", () => {
    expect(toTypst("<div>html</div>")).toContain("\\[HTML block removed\\]");
  });

  it("warns on strikethrough", () => {
    const w = getWarnings("~~deleted~~");
    expect(w.some((w) => w.nodeType === "delete")).toBe(true);
  });
});

describe("lists", () => {
  it("renders unordered list", () => {
    const result = toTypst("- one\n- two\n- three");
    expect(result).toContain("- one");
    expect(result).toContain("- two");
    expect(result).toContain("- three");
  });

  it("renders ordered list", () => {
    const result = toTypst("1. one\n2. two");
    expect(result).toContain("+ one");
    expect(result).toContain("+ two");
  });

  it("renders nested list", () => {
    const result = toTypst("- outer\n  - inner");
    expect(result).toContain("  - inner");
  });
});

describe("tables", () => {
  it("renders a simple table", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const result = toTypst(md);
    expect(result).toContain("#table(columns: 2");
    expect(result).toContain("[A]");
    expect(result).toContain("[1]");
  });

  it("warns on alignment", () => {
    const md = "| A | B |\n|---:|---:|\n| 1 | 2 |";
    const w = getWarnings(md);
    expect(w.some((w) => w.message.includes("alignment"))).toBe(true);
  });
});

describe("footnotes", () => {
  it("renders a footnote", () => {
    const md = "Text[^1]\n\n[^1]: Footnote content";
    const result = toTypst(md);
    expect(result).toContain("#footnote[");
    expect(result).toContain("Footnote content");
    expect(result).toContain("<fn-1>");
  });

  it("renders duplicate footnote references", () => {
    const md = "First[^a] and second[^a]\n\n[^a]: Note";
    const result = toTypst(md);
    expect(result).toContain("#footnote[");
    expect(result).toContain("@fn-a");
  });

  it("treats missing footnote ref as literal text (parser behavior)", () => {
    // remark-gfm does not create footnoteReference nodes when no
    // definition exists — the syntax stays as literal text.
    const result = toTypst("Text[^missing]");
    expect(result).toContain("\\[^missing\\]");
  });
});
