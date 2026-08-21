// One Markdown file must give one PDF from either front-end; the only sanctioned divergences are asserted at the bottom of this file.

import { describe, it, expect } from "bun:test";
import { spawnSync } from "child_process";
import { join } from "path";
import { markdownToTypst } from "../src/pipeline";

const REPO_ROOT = join(import.meta.dir, "../..");
const READER_DIALECT = [
  "markdown_strict",
  "smart",
  "pipe_tables",
  "strikeout",
  "task_lists",
  "footnotes",
  "yaml_metadata_block",
  "mark",
  "subscript",
  "superscript",
  "emoji",
  "autolink_bare_uris",
  "backtick_code_blocks",
  "fenced_code_blocks",
  "fenced_code_attributes",
].join("+");

function pandocAvailable(): boolean {
  return spawnSync("pandoc", ["--version"], { encoding: "utf-8" }).status === 0;
}

function viaCli(markdown: string, mermaid = false): string {
  const args = [
    "-f",
    READER_DIALECT,
    "-t",
    "typst",
    "--lua-filter",
    join(REPO_ROOT, "cmd/filters/table.lua"),
    "--lua-filter",
    join(REPO_ROOT, "cmd/filters/pagebreak.lua"),
    "--lua-filter",
    join(REPO_ROOT, "cmd/filters/mermaid.lua"),
  ];
  if (mermaid) args.push("-M", "mermaid=true");
  const proc = spawnSync("pandoc", args, { input: markdown, encoding: "utf-8" });
  if (proc.status !== 0) throw new Error(`pandoc failed: ${proc.stderr}`);
  return proc.stdout;
}

function viaWeb(markdown: string, mermaid = false): string {
  const { typstSource } = markdownToTypst(markdown, { templateOverride: "", mermaid });
  return typstSource;
}

// Collapses only what cannot change a rendered page: wrapping, bracket padding, and Pandoc's `#emph[x]` for the equivalent `_x_` markup the web prefers for a readable source view.
function normalise(typst: string): string {
  return typst
    .replace(/#emph\[([^\]]*)\]/g, "_$1_")
    .replace(/#strong\[([^\]]*)\]/g, "*$1*")
    .replace(/\s+/g, " ")
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .trim();
}

/** Browser-only: the CLI resolves emoji through system fonts, so it needs no such rule. */
const EMOJI_RULE = /#show regex\("\\p\{Emoji_Presentation\}"\): it => text\(font: "[^"]+", it\)/;

const CASES: { name: string; markdown: string }[] = [
  { name: "prose tilde", markdown: "Engineer with ~10 years across backend." },
  { name: "tilde pair with spaces", markdown: "grew to ~300 subs at 50/mo (~15k MRR)" },
  { name: "subscript", markdown: "H~2~O is water." },
  { name: "superscript", markdown: "E = mc^2^ holds." },
  { name: "highlight", markdown: "this is ==important== text" },
  { name: "strikethrough", markdown: "this is ~~gone~~ now" },
  { name: "emphasis and strong", markdown: "*italic* and **bold** together" },
  { name: "inline code", markdown: "a `code_span` inline" },
  { name: "heading levels", markdown: [1, 2, 3, 4, 5, 6].map((n) => `${"#".repeat(n)} Level ${n}`).join("\n\n") },
  { name: "pipe table", markdown: "| Name | Value |\n|---|---|\n| foo | 1 |\n| bar | 2 |" },
  { name: "wide table", markdown: "| Key | A column wide enough to pass the prose threshold here |\n|---|---|\n| a | b |" },
  { name: "page break", markdown: "before\n\n+++\n\nafter" },
  { name: "smart typography", markdown: 'a -- b and "quoted" text' },
  { name: "link", markdown: "[text](https://example.com/a_b)" },
  { name: "emoji shortcode", markdown: "shipping :rocket: today" },
  { name: "bullet list", markdown: "- one\n- two\n- three" },
  { name: "blockquote", markdown: "> quoted line" },
];

const MERMAID = '```mermaid\nxychart-beta\n  bar [2, 1, 3]\n```';

describe.if(pandocAvailable())("CLI and web agree", () => {
  for (const { name, markdown } of CASES) {
    it(name, () => {
      const cli = normalise(viaCli(markdown));
      // Pandoc resolves ... to the glyph; the web leaves it for Typst to do the same.
      const web = normalise(viaWeb(markdown)).replace(EMOJI_RULE, "").replace(/\.\.\./g, "…").trim();
      expect(web).toBe(cli);
    });
  }

  it("adds the emoji rule on the web only, the CLI having system fonts", () => {
    expect(viaWeb("shipping :rocket: today")).toMatch(EMOJI_RULE);
    expect(viaCli("shipping :rocket: today")).not.toMatch(EMOJI_RULE);
    expect(viaWeb("no emoji here")).not.toMatch(EMOJI_RULE);
  });

  // Mermaid is gated by the same switch on both sides: off prints the source, on injects merman. Either state must agree.
  it("agrees on mermaid with the switch off: both print the source", () => {
    expect(normalise(viaWeb(MERMAID, false))).toBe(normalise(viaCli(MERMAID, false)));
  });

  it("agrees on mermaid with the switch on: both render via merman", () => {
    const web = normalise(viaWeb(MERMAID, true));
    const cli = normalise(viaCli(MERMAID, true));
    expect(web).toBe(cli);
    expect(web).toContain("@preview/merman");
    expect(web).toContain("show-mermaid-blocks");
  });

  it("documents the one divergence: a browser cannot read a local image path", () => {
    const markdown = "![alt](./photo.png)";
    expect(normalise(viaCli(markdown))).toContain('image("./photo.png")');
    // Web output only carries an image once the file has been mapped into the VFS.
    expect(normalise(viaWeb(markdown))).toContain('image("./photo.png")');
    expect(normalise(viaWeb("![alt](https://x.test/p.png)"))).toBe("");
  });
});
