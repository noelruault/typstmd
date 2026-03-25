import { describe, it, expect } from "bun:test";
import {
  extractFrontmatter,
  encodeConfInvocation,
} from "../src/frontmatter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";

function parse(md: string) {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .parse(md);
}

describe("extractFrontmatter", () => {
  it("returns empty object for no frontmatter", () => {
    const tree = parse("# Hello");
    expect(extractFrontmatter(tree)).toEqual({});
  });

  it("extracts title", () => {
    const tree = parse("---\ntitle: My Doc\n---\n# Hello");
    expect(extractFrontmatter(tree).title).toBe("My Doc");
  });

  it("extracts single author as array", () => {
    const tree = parse("---\nauthor: Jane Doe\n---\n");
    expect(extractFrontmatter(tree).author).toEqual(["Jane Doe"]);
  });

  it("extracts author array", () => {
    const tree = parse("---\nauthor:\n  - Alice\n  - Bob\n---\n");
    expect(extractFrontmatter(tree).author).toEqual(["Alice", "Bob"]);
  });

  it("extracts date", () => {
    const tree = parse("---\ndate: 2025-01-15\n---\n");
    expect(extractFrontmatter(tree).date).toBe("2025-01-15");
  });

  it("handles missing fields gracefully", () => {
    const tree = parse("---\ntitle: Only Title\n---\n");
    const meta = extractFrontmatter(tree);
    expect(meta.title).toBe("Only Title");
    expect(meta.author).toBeUndefined();
    expect(meta.date).toBeUndefined();
  });
});

describe("encodeConfInvocation", () => {
  it("encodes empty metadata", () => {
    expect(encodeConfInvocation({})).toBe("#show: doc => conf(doc)");
  });

  it("encodes title", () => {
    const result = encodeConfInvocation({ title: "My Title" });
    expect(result).toContain("title: [My Title]");
  });

  it("escapes special chars in title", () => {
    const result = encodeConfInvocation({ title: "Price #5" });
    expect(result).toContain("title: [Price \\#5]");
  });

  it("encodes single author", () => {
    const result = encodeConfInvocation({ author: ["Jane Doe"] });
    expect(result).toContain("authors: ((name: [Jane Doe]),)");
  });

  it("encodes multiple authors", () => {
    const result = encodeConfInvocation({ author: ["Alice", "Bob"] });
    expect(result).toContain("(name: [Alice])");
    expect(result).toContain("(name: [Bob])");
  });

  it("encodes date", () => {
    const result = encodeConfInvocation({ date: "2025-01-15" });
    expect(result).toContain("date: [2025-01-15]");
  });

  it("encodes lang as string literal", () => {
    const result = encodeConfInvocation({ lang: "fr" });
    expect(result).toContain('lang: "fr"');
  });
});
