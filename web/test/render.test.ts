// String assertions cannot see a deleted tilde, a shrunken title or a missing font.
// These compile with --ignore-system-fonts so the font set matches the browser, then assert on the PDF via poppler. Skips when typst or poppler is absent.

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { markdownToTypst } from "../src/pipeline";
import { themes } from "../src/themes";
import { starters } from "../src/starters";

const EMOJI_FONT_DIR = process.env.TYPSTMD_EMOJI_FONT_DIR;

function has(bin: string, args: string[] = ["--version"]): boolean {
  try {
    execFileSync(bin, args, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const canCompile = has("typst");
const canInspect = has("pdftotext", ["-v"]) && has("pdffonts", ["-v"]);
let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "typstmd-render-"));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

interface Rendered {
  stderr: string;
  text: string;
  fonts: string;
  words: { text: string; height: number }[];
}

function render(markdown: string, themeId = "default"): Rendered {
  const { typstSource, needsEmojiFont } = markdownToTypst(markdown, { themeId });
  const srcPath = join(tmpDir, `${themeId}-${Math.abs(hash(markdown))}.typ`);
  const pdfPath = srcPath.replace(/\.typ$/, ".pdf");
  writeFileSync(srcPath, typstSource, "utf-8");

  const args = ["compile", "--ignore-system-fonts"];
  // The emoji face is fetched at runtime in the browser; tests need it on disk to render.
  if (needsEmojiFont && EMOJI_FONT_DIR) args.push("--font-path", EMOJI_FONT_DIR);
  args.push(srcPath, pdfPath);

  // spawnSync, not execFileSync: warnings go to stderr on success and must be asserted on.
  const proc = spawnSync("typst", args, { encoding: "utf-8" });
  if (proc.status !== 0) {
    throw new Error(`typst failed: ${proc.stderr}`);
  }
  const stderr = proc.stderr ?? "";

  const text = execFileSync("pdftotext", [pdfPath, "-"], { stdio: "pipe" }).toString();
  const fonts = execFileSync("pdffonts", [pdfPath], { stdio: "pipe" }).toString();
  const bbox = execFileSync("pdftotext", ["-bbox", "-f", "1", "-l", "1", pdfPath, "-"], {
    stdio: "pipe",
  }).toString();

  const words = [...bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map(
    (m) => ({ text: m[5], height: Number(m[4]) - Number(m[2]) }),
  );

  return { stderr, text, fonts, words };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe.if(canCompile && canInspect)("rendered output", () => {
  it("keeps a prose tilde instead of eating it as a non-breaking space", () => {
    const { text } = render("Engineer with ~10 years across backend.");
    expect(text).toContain("~10 years");
  });

  it("keeps a tilde pair containing whitespace at body size", () => {
    const { text } = render("Grew to **~300 paying subscribers at €50/mo (~€15k MRR)**, sustained ~2 years.");
    expect(text.replace(/\s+/g, " ")).toContain("~300 paying subscribers at €50/mo (~€15k MRR)");
  });

  it("keeps HTML text content without injecting placeholder prose", () => {
    const { text } = render("para with <br> a break and <em>tags</em>.");
    expect(text).toContain("tags");
    expect(text).not.toContain("HTML block removed");
  });

  it("scales inline code with its context instead of pinning it to body size", () => {
    // Same glyphs, same font, so only the size differs: the bug rendered both at 9pt (ratio 1.0).
    const { words } = render("# Heading `proxymd` here\n\nBody `proxymd` here.\n");
    const [inHeading, inBody] = words.filter((w) => w.text.includes("proxymd"));
    expect(inHeading).toBeDefined();
    expect(inBody).toBeDefined();
    expect(inHeading.height / inBody.height).toBeGreaterThan(1.5);
  });

  it("compiles a raw Typst template that defines no conf", () => {
    // Frontmatter with an author included: document.author takes strings, and emitting content there is a compile error no string assertion can see.
    const { typstSource } = markdownToTypst("---\ntitle: Raw\nauthor: Someone\n---\n\n= Heading\n\nBody text.\n", {
      templateOverride: '#set page(paper: "a4")\n#set text(font: "Libertinus Serif", size: 11pt)',
    });
    const srcPath = join(tmpDir, "raw-template.typ");
    const pdfPath = join(tmpDir, "raw-template.pdf");
    writeFileSync(srcPath, typstSource, "utf-8");
    const proc = spawnSync("typst", ["compile", "--ignore-system-fonts", srcPath, pdfPath], {
      encoding: "utf-8",
    });
    expect(proc.status).toBe(0);
    expect(proc.stderr).not.toContain("unknown variable");
    expect(execFileSync("pdftotext", [pdfPath, "-"], { stdio: "pipe" }).toString()).toContain("Body text.");
  });

  it("repeats a table header on every page it spans", () => {
    const rows = Array.from({ length: 90 }, (_, i) => `| Key ${i} | Value ${i} |`).join("\n");
    const md = `| Column | Description |\n|---|---|\n${rows}\n`;
    const { text } = render(md);
    const headerCount = [...text.matchAll(/Column/g)].length;
    expect(headerCount).toBeGreaterThan(1);
  });

  it("renders six distinct heading levels", () => {
    const md = [1, 2, 3, 4, 5, 6].map((n) => `${"#".repeat(n)} Level${n}`).join("\n\n");
    const { words } = render(md);
    const heights = [1, 2, 3, 4, 5, 6].map((n) => words.find((w) => w.text === `Level${n}`)?.height ?? 0);
    expect(heights.every((h) => h > 0)).toBe(true);
    // h1 must outrank h6; the clamp used to collapse 4-6 into one size.
    expect(heights[0]).toBeGreaterThan(heights[5]);
    expect(new Set(heights).size).toBeGreaterThan(3);
  });

  // Typst abbreviates some families when embedding: "New Computer Modern" ships as "NewCM".
  const EMBEDDED_AS: Record<string, string> = {
    "Libertinus Serif": "LibertinusSerif",
    "New Computer Modern": "NewCM",
    "DejaVu Sans Mono": "DejaVuSansMono",
  };

  for (const theme of themes) {
    it(`${theme.id}: names no font it cannot load`, () => {
      const { stderr, fonts } = render("# Title\n\nBody with `code`.\n", theme.id);
      expect(stderr).not.toContain("unknown font family");
      for (const family of theme.fonts.families) {
        expect(fonts).toContain(EMBEDDED_AS[family] ?? family);
      }
    });
  }

  // Downloads packages, so it is opt-in: CI stays hermetic, but a hand-written preamble that invents a parameter is only caught by compiling it.
  describe.if(process.env.TYPSTMD_NETWORK_TESTS === "1")("universe starters compile", () => {
    for (const starter of starters) {
      it(starter.id, () => {
        const { typstSource } = markdownToTypst("= Section\n\nBody text.\n", {
          templateOverride: starter.preamble,
        });
        const srcPath = join(tmpDir, `starter-${starter.id}.typ`);
        const pdfPath = srcPath.replace(/\.typ$/, ".pdf");
        writeFileSync(srcPath, typstSource, "utf-8");
        const proc = spawnSync("typst", ["compile", srcPath, pdfPath], { encoding: "utf-8" });
        expect(proc.stderr).not.toContain("error:");
        expect(proc.status).toBe(0);
      });
    }
  });

  it.if(Boolean(EMOJI_FONT_DIR))("embeds the emoji face only when the document has emoji", () => {
    const withEmoji = render("Shipping :rocket: today.\n");
    expect(withEmoji.fonts).toContain("NotoColorEmoji");
    expect(withEmoji.stderr).not.toContain("unknown font family");

    const without = render("Shipping today.\n");
    expect(without.fonts).not.toContain("NotoColorEmoji");
  });
});
