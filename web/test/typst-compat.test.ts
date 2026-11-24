// The two-way compatibility contract (AGENTS.md, "Typst compatibility"): a template that works in typstmd compiles in plain `typst`, and the other way around.
// Warnings are allowed; an error is not.
// Every typstmd-specific hook a template can use is a row in HOOKS, and a new hook is not done until it has one.

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { markdownToTypst } from "../src/pipeline";
import { themes } from "../src/themes";

interface Hook {
  name: string;
  template: string;
  // Text the rendered PDF must contain when the document has frontmatter, proving the hook delivered its value.
  expectText?: string;
}

const HOOKS: Hook[] = [
  { name: "a FONT_URLS family the compiler does not have", template: `#set text(font: "Montserrat")\n` },
  { name: "an unknown font family with a fallback", template: `#set text(font: ("No Such Font", "Libertinus Serif"))\n` },
  { name: "an unknown font family alone", template: `#set text(font: "No Such Font")\n` },
  { name: "a // font-url: line, unreachable", template: `// font-url: https://fonts.invalid/Nope.ttf\n#set text(font: "Nope")\n` },
  { name: "the body marker, guarded", template: `#let typstmd-body = [Preview body]\n#set text(size: 11pt)\n#typstmd-body\n` },
  {
    name: "frontmatter as a conf parameter",
    template: `#let conf(title: none, authors: (), date: none, lang: "en", toc: false, frontmatter: (:), doc) = {\n  [Client: #frontmatter.at("client", default: [none])]\n  doc\n}\n`,
    expectText: "Client: Acme",
  },
  {
    name: "the conf convention",
    template: `#let conf(title: none, authors: (), date: none, lang: "en", toc: false, doc) = {\n  if title != none { heading(title) }\n  doc\n}\n`,
  },
];

// typstmd accepts these, but plain Typst cannot: the pipeline warns with the compatible form instead.
const TYPSTMD_ONLY: Hook[] = [
  { name: "the body marker, unguarded", template: `#set text(size: 11pt)\n#typstmd-body\n` },
  { name: "the global frontmatter dictionary", template: `#let client = frontmatter.at("client", default: [none])\nClient: #client\n` },
];

const WITH_FRONTMATTER = "---\ntitle: Compat\nauthor: Jane\nclient: Acme\n---\n\nHello *world*.\n";
const WITHOUT_FRONTMATTER = "Hello *world*.\n";

function has(bin: string, args: string[] = ["--version"]): boolean {
  try {
    execFileSync(bin, args, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const canCompile = has("typst");
const canReadPdf = has("pdftotext", ["-v"]);
let tmpDir: string;
let fileCount = 0;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "typstmd-compat-"));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// compile runs the upstream compiler with --ignore-system-fonts, the font set the browser has.
function compile(source: string): { status: number | null; stderr: string; pdfPath: string } {
  const srcPath = join(tmpDir, `doc-${fileCount++}.typ`);
  const pdfPath = srcPath.replace(/\.typ$/, ".pdf");
  writeFileSync(srcPath, source, "utf-8");
  const proc = spawnSync("typst", ["compile", "--ignore-system-fonts", srcPath, pdfPath], { encoding: "utf-8" });
  return { status: proc.status, stderr: proc.stderr, pdfPath };
}

function expectCompiles(source: string): string {
  const { status, stderr, pdfPath } = compile(source);
  expect(stderr).not.toMatch(/^error/m);
  expect(status).toBe(0);
  return pdfPath;
}

describe.if(canCompile)("Typst compatibility", () => {
  describe("each hook compiles in plain typst, unchanged", () => {
    for (const hook of HOOKS) {
      it(hook.name, () => {
        expectCompiles(hook.template);
      });
    }
  });

  describe("each hook compiles through typstmd, with and without frontmatter", () => {
    for (const hook of HOOKS) {
      it(hook.name, () => {
        for (const markdown of [WITH_FRONTMATTER, WITHOUT_FRONTMATTER]) {
          const { typstSource, warnings } = markdownToTypst(markdown, { templateOverride: hook.template });
          expect(warnings.filter((w) => w.nodeType === "template")).toEqual([]);
          const pdfPath = expectCompiles(typstSource);
          if (hook.expectText && markdown === WITH_FRONTMATTER && canReadPdf) {
            expect(execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf-8" })).toContain(hook.expectText);
          }
        }
      });
    }
  });

  describe("typstmd-only forms still compile in typstmd and warn", () => {
    for (const hook of TYPSTMD_ONLY) {
      it(hook.name, () => {
        expect(compile(hook.template).stderr).toMatch(/error: unknown variable/);
        for (const markdown of [WITH_FRONTMATTER, WITHOUT_FRONTMATTER]) {
          const { typstSource, warnings } = markdownToTypst(markdown, { templateOverride: hook.template });
          expect(warnings.some((w) => w.nodeType === "template")).toBe(true);
          expectCompiles(typstSource);
        }
      });
    }
  });

  describe("every built-in theme compiles in plain typst on its own", () => {
    for (const theme of themes) {
      it(theme.id, () => {
        expectCompiles(theme.template);
      });
    }
  });
});
