import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkEmoji from "remark-emoji";
import remarkSubSuper from "../src/remark-sub-super";
import remarkHighlight from "../src/remark-highlight";
import { mdastToTypst } from "../src/mdast-to-typst";
import { createWarningCollector } from "../src/warnings";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

/** Parse markdown to MDAST (with all plugins) and serialize to Typst body (no template) */
function toTypst(md: string): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkEmoji)
    .use(remarkSubSuper)
    .use(remarkHighlight);
  const tree = processor.runSync(processor.parse(md));
  const warnings = createWarningCollector();
  return mdastToTypst(tree, { warnings });
}

// Discover all .md files in fixtures/ and pair with .typ expected output
const mdFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".md"));

describe("fixture snapshot tests", () => {
  for (const mdFile of mdFiles) {
    const name = mdFile.replace(/\.md$/, "");
    const typFile = `${name}.typ`;

    it(`${name}: markdown → typst matches expected output`, () => {
      const mdPath = join(FIXTURES_DIR, mdFile);
      const typPath = join(FIXTURES_DIR, typFile);

      const mdInput = readFileSync(mdPath, "utf-8");
      const expectedTypst = readFileSync(typPath, "utf-8");

      const actual = toTypst(mdInput);
      expect(actual).toBe(expectedTypst);
    });
  }
});
