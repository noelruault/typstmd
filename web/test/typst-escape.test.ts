import { describe, it, expect } from "bun:test";
import { escapeText, escapeUrl, escapeLabel } from "../src/typst-escape";

describe("escapeText", () => {
  it("returns empty string unchanged", () => {
    expect(escapeText("")).toBe("");
  });

  it("passes plain ASCII through", () => {
    expect(escapeText("hello world")).toBe("hello world");
  });

  it("escapes hash", () => {
    expect(escapeText("price is #5")).toBe("price is \\#5");
  });

  it("escapes at sign", () => {
    expect(escapeText("email@test")).toBe("email\\@test");
  });

  it("escapes dollar sign", () => {
    expect(escapeText("costs $10")).toBe("costs \\$10");
  });

  it("escapes backslash", () => {
    expect(escapeText("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("escapes asterisks", () => {
    expect(escapeText("*bold*")).toBe("\\*bold\\*");
  });

  it("escapes underscores", () => {
    expect(escapeText("_italic_")).toBe("\\_italic\\_");
  });

  it("escapes backticks", () => {
    expect(escapeText("`code`")).toBe("\\`code\\`");
  });

  it("escapes square brackets", () => {
    expect(escapeText("[link]")).toBe("\\[link\\]");
  });

  it("escapes angle brackets", () => {
    expect(escapeText("<tag>")).toBe("\\<tag\\>");
  });

  it("escapes multiple special chars in one string", () => {
    expect(escapeText("#hello @world $5")).toBe("\\#hello \\@world \\$5");
  });

  it("handles adjacent markup characters", () => {
    expect(escapeText("**bold**")).toBe("\\*\\*bold\\*\\*");
  });

  it("handles smart punctuation (em dash)", () => {
    expect(escapeText("word — word")).toBe("word — word");
  });

  it("preserves unicode", () => {
    expect(escapeText("café résumé")).toBe("café résumé");
  });
});

describe("escapeUrl", () => {
  it("returns empty string unchanged", () => {
    expect(escapeUrl("")).toBe("");
  });

  it("passes simple URLs through", () => {
    expect(escapeUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("escapes double quotes", () => {
    expect(escapeUrl('https://example.com/?q="test"')).toBe(
      'https://example.com/?q=\\"test\\"',
    );
  });

  it("escapes backslashes", () => {
    expect(escapeUrl("C:\\Users\\file")).toBe("C:\\\\Users\\\\file");
  });

  it("escapes newlines", () => {
    expect(escapeUrl("line1\nline2")).toBe("line1\\nline2");
  });

  it("does not escape hash (valid in URLs)", () => {
    expect(escapeUrl("https://example.com/#section")).toBe(
      "https://example.com/#section",
    );
  });

  it("does not escape brackets (valid in URLs)", () => {
    expect(escapeUrl("https://example.com/[path]")).toBe(
      "https://example.com/[path]",
    );
  });
});

describe("escapeLabel", () => {
  it("returns empty string unchanged", () => {
    expect(escapeLabel("")).toBe("");
  });

  it("passes simple labels through", () => {
    expect(escapeLabel("fn-first")).toBe("fn-first");
  });

  it("replaces spaces with hyphens", () => {
    expect(escapeLabel("my label")).toBe("my-label");
  });

  it("replaces special characters with hyphens", () => {
    expect(escapeLabel("foot#note@1")).toBe("foot-note-1");
  });

  it("collapses multiple hyphens", () => {
    expect(escapeLabel("a---b")).toBe("a-b");
  });

  it("strips leading and trailing hyphens", () => {
    expect(escapeLabel("--test--")).toBe("test");
  });

  it("allows underscores", () => {
    expect(escapeLabel("my_label")).toBe("my_label");
  });

  it("handles complex footnote IDs", () => {
    expect(escapeLabel("footnote [1]")).toBe("footnote-1");
  });
});
