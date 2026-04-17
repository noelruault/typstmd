import { describe, it, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkSubSuper from "../src/remark-sub-super";
import remarkHighlight from "../src/remark-highlight";
import { mdastToTypst } from "../src/mdast-to-typst";
import { createWarningCollector } from "../src/warnings";

function makeProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkSubSuper)
    .use(remarkHighlight);
}

/** Parse markdown to MDAST and serialize to Typst body (no template) */
function toTypst(md: string): string {
  const processor = makeProcessor();
  const tree = processor.runSync(processor.parse(md));
  const warnings = createWarningCollector();
  return mdastToTypst(tree, { warnings });
}

function getWarnings(md: string) {
  const processor = makeProcessor();
  const tree = processor.runSync(processor.parse(md));
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
    expect(toTypst("---")).toBe("#block[#v(6pt)#line(length: 100%, stroke: 0.5pt + luma(180))#v(6pt)]");
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

describe("strikethrough", () => {
  it("renders strikethrough with #strike", () => {
    expect(toTypst("~~deleted~~")).toBe("#strike[deleted]");
  });

  it("does not warn on strikethrough", () => {
    const w = getWarnings("~~deleted~~");
    expect(w.some((w) => w.nodeType === "delete")).toBe(false);
  });
});

describe("images", () => {
  it("renders remote image as placeholder", () => {
    expect(toTypst("![alt text](http://img.png)")).toBe(
      "\\[Image: alt text\\]",
    );
  });

  it("renders local image with #figure", () => {
    expect(toTypst("![alt text](./photo.png)")).toBe(
      '#figure(image("./photo.png"), caption: [alt text])',
    );
  });

  it("renders local image without alt", () => {
    expect(toTypst("![](./photo.png)")).toBe(
      '#figure(image("./photo.png"))',
    );
  });

  it("does not warn on images with URL", () => {
    const w = getWarnings("![alt](http://img.png)");
    expect(w.some((w) => w.nodeType === "image")).toBe(false);
  });
});

describe("subscript", () => {
  it("renders subscript with #sub", () => {
    expect(toTypst("H~2~O")).toBe("H#sub[2]O");
  });
});

describe("superscript", () => {
  it("renders superscript with #super", () => {
    expect(toTypst("19^th^")).toBe("19#super[th]");
  });
});

describe("highlight", () => {
  it("renders highlight with #highlight", () => {
    expect(toTypst("==marked==")).toBe("#highlight[marked]");
  });

  it("renders inline highlight", () => {
    expect(toTypst("before ==marked== after")).toBe("before #highlight[marked] after");
  });
});

describe("unsupported nodes", () => {
  it("warns on HTML", () => {
    const w = getWarnings("<div>html</div>");
    expect(w.some((w) => w.nodeType === "html")).toBe(true);
  });

  it("renders HTML placeholder", () => {
    expect(toTypst("<div>html</div>")).toContain("\\[HTML block removed\\]");
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
    // definition exists, so the syntax stays as literal text.
    const result = toTypst("Text[^missing]");
    expect(result).toContain("\\[^missing\\]");
  });
});

describe("regression: Typst function calls use # prefix", () => {
  // Guard against the class of bug where a Typst function/variable name
  // is emitted as a bare identifier (renders as literal text in PDF).

  it("thematic break starts with #", () => {
    const result = toTypst("---");
    expect(result).toMatch(/^#block\[/);
  });

  it("link output starts with #link", () => {
    const result = toTypst("[click](https://example.com)");
    expect(result).toMatch(/^#link\(/);
  });

  it("blockquote output starts with #quote", () => {
    const result = toTypst("> hello");
    expect(result).toMatch(/^#quote\(/);
  });

  it("table output starts with #table", () => {
    const result = toTypst("| A |\n|---|\n| 1 |");
    expect(result).toMatch(/^#table\(/);
  });

  it("footnote output contains #footnote", () => {
    const result = toTypst("Text[^1]\n\n[^1]: Note");
    expect(result).toContain("#footnote[");
  });

  it("no bare identifiers leak as Typst function names", () => {
    // Compile a document that exercises every node type and check that
    // known Typst function names only appear prefixed with #.
    const md = [
      "# Heading",
      "",
      "Paragraph with **bold** and *italic* and `code`.",
      "",
      "[link](https://example.com)",
      "",
      "> blockquote",
      "",
      "---",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "Text[^1]",
      "",
      "[^1]: Footnote",
      "",
      "- list item",
      "",
      "1. ordered",
      "",
      "~~strikethrough~~",
      "",
      "~~strikethrough~~",
      "",
      "![alt](./local.png)",
    ].join("\n");

    const result = toTypst(md);

    // These Typst identifiers must only appear after #
    const typstFunctions = [
      "footnote",
      "table",
      "quote",
      "link",
      "strike",
      "figure",
    ];

    for (const fn of typstFunctions) {
      // Find all occurrences and verify each is preceded by #
      const regex = new RegExp(`(?<!#)(?<![a-zA-Z])${fn}(?=\\(|\\[|\\b)`, "g");
      const bareMatches = result.match(regex);
      // Filter out occurrences inside content blocks [...] or strings
      // by checking that each match in the output is preceded by #
      // Match function name only when followed by ( or [ (actual function call syntax)
      const allOccurrences = [...result.matchAll(new RegExp(`${fn}(?=[\\(\\[])`, "g"))];
      for (const match of allOccurrences) {
        const idx = match.index!;
        // Skip if inside a content block (e.g., table cell [footnote...])
        // Only check top-level function calls
        if (idx > 0 && result[idx - 1] === "#") continue;
        // Allow inside content blocks like [Footnote] or code blocks
        // Check if this is a bare top-level identifier
        const before = result.slice(Math.max(0, idx - 20), idx);
        const isInsideBlock =
          before.includes("[") && !before.includes("]");
        const isInsideCode = before.includes("```");
        if (!isInsideBlock && !isInsideCode) {
          // This would be a bare identifier - it should have # prefix
          expect(result[idx - 1]).toBe("#");
        }
      }
    }
  });
});
