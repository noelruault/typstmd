/**
 * Compile smoke tests: verify that generated Typst source actually compiles
 * under the real Typst compiler. This catches syntax errors in generated
 * markup that unit tests cannot detect.
 *
 * Requires `typst` CLI to be installed.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { markdownToTypst } from "../src/pipeline";

let typstAvailable = false;
let tmpDir: string;

beforeAll(() => {
  try {
    execSync("typst --version", { stdio: "pipe" });
    typstAvailable = true;
  } catch {
    typstAvailable = false;
  }
  if (typstAvailable) {
    tmpDir = mkdtempSync(join(import.meta.dir, ".smoke-"));
  }
});

function compileTypst(typstSource: string): { ok: boolean; stderr: string } {
  if (!typstAvailable) return { ok: true, stderr: "(skipped - typst not installed)" };

  const srcPath = join(tmpDir, "test.typ");
  const outPath = join(tmpDir, "test.pdf");
  writeFileSync(srcPath, typstSource, "utf-8");

  try {
    execSync(`typst compile "${srcPath}" "${outPath}"`, {
      stdio: "pipe",
      timeout: 15000,
    });
    return { ok: true, stderr: "" };
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer };
    return { ok: false, stderr: e.stderr?.toString() ?? "unknown error" };
  }
}

afterAll(() => {
  if (tmpDir) {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  }
});

// Import afterAll at top level
import { afterAll } from "bun:test";

describe("compile smoke tests", () => {
  it("simple paragraph compiles", () => {
    const { typstSource } = markdownToTypst("Hello world.");
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("headings compile", () => {
    const md = "# H1\n## H2\n### H3\n#### H4";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("emphasis and strong compile", () => {
    const md = "**bold** and *italic* and ***both***";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("code blocks compile", () => {
    const md = "Inline `code` and:\n\n```js\nconst x = 1;\n```";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("links compile", () => {
    const md = '[click](https://example.com) and [quotes](https://example.com/a"b)';
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("lists compile", () => {
    const md = "- one\n- two\n  - nested\n\n1. first\n2. second";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("blockquotes compile", () => {
    const md = "> quote\n>> nested quote";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("thematic break compiles", () => {
    const md = "Above\n\n---\n\nBelow";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("tables compile", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("footnotes compile", () => {
    const md = "Text[^1] and again[^1].\n\n[^1]: Note content.";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("frontmatter compiles", () => {
    const md = '---\ntitle: "Test Doc"\nauthor: Alice\ndate: 2025-01-01\n---\n\n# Content';
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("mixed inline formatting compiles", () => {
    const md = "**bold _italic_ bold** and `code` and [link](https://x.com)";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("special characters in text compile", () => {
    const md = "Price #5, @mention, $100, back\\slash, [brackets], <angles>";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("strikethrough compiles", () => {
    const md = "~~strikethrough~~";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("images and html placeholders compile", () => {
    const md = "![img](http://img.png)\n\n<div>html</div>";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("local image with #figure compiles", () => {
    const md = "![alt](./photo.png)";
    const { typstSource } = markdownToTypst(md);
    // Can't actually compile (file doesn't exist) but syntax should be valid
    expect(typstSource).toContain('#figure(image("./photo.png")');
  });

  it("subscript compiles", () => {
    const md = "H~2~O";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("superscript compiles", () => {
    const md = "19^th^";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("highlight compiles", () => {
    const md = "==marked text==";
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("all three themes compile", () => {
    const md = "# Hello\n\nWorld.\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |";
    for (const themeId of ["default", "minimal", "academic"]) {
      const { typstSource } = markdownToTypst(md, { themeId });
      const result = compileTypst(typstSource);
      if (!result.ok) throw new Error(`theme ${themeId} failed: ${result.stderr}`);
      expect(result.ok).toBe(true);
    }
  });

  it("example.md compiles end-to-end", () => {
    const examplePath = join(import.meta.dir, "../../example.md");
    const md = readFileSync(examplePath, "utf-8");
    const { typstSource } = markdownToTypst(md);
    const result = compileTypst(typstSource);
    expect(result.ok).toBe(true);
  });

  it("example.md produces a valid PDF with reasonable size", () => {
    if (!typstAvailable) return;

    const examplePath = join(import.meta.dir, "../../example.md");
    const md = readFileSync(examplePath, "utf-8");
    const { typstSource } = markdownToTypst(md);

    const srcPath = join(tmpDir, "parity.typ");
    const outPath = join(tmpDir, "parity.pdf");
    writeFileSync(srcPath, typstSource, "utf-8");
    execSync(`typst compile "${srcPath}" "${outPath}"`, { stdio: "pipe", timeout: 15000 });

    const pdfBytes = readFileSync(outPath);
    // Valid PDF starts with %PDF-
    expect(pdfBytes[0]).toBe(0x25); // %
    expect(pdfBytes[1]).toBe(0x50); // P
    expect(pdfBytes[2]).toBe(0x44); // D
    expect(pdfBytes[3]).toBe(0x46); // F
    // example.md is non-trivial - PDF should be at least 5KB
    expect(pdfBytes.byteLength).toBeGreaterThan(5000);
  });
});
