// String assertions cannot see a deleted tilde, a shrunken title or a missing font.
// These compile with --ignore-system-fonts so the font set matches the browser, then assert on the PDF via poppler. Skips when typst or poppler is absent.

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { markdownToTypst } from "../src/pipeline";
import { themes, FONT_URLS, EMOJI_FONT } from "../src/themes";
import { starters } from "../src/starters";

const EMBEDDED = ["Libertinus Serif", "New Computer Modern", "New Computer Modern Math", "DejaVu Sans Mono"];
const namedFonts = (t: string) =>
  [...new Set([...t.matchAll(/(?:font: |[\w-]*-font\s*=\s*)"([^"]+)"/g)].map((m) => m[1]))];
// Set once the CDN faces are fetched (only under NETWORK); render() adds it as a --font-path.
let fontsDir: string | null = null;

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

const NETWORK = process.env.TYPSTMD_NETWORK_TESTS === "1";

// Ten faces, one of them Noto Color Emoji at 10.7 MB. Serially they do not fit bun's 5s
// default hook budget, which failed the CI deploy at 5000.15ms; concurrently the hook costs
// the slowest single download rather than the sum, and the explicit timeout leaves headroom
// for a slow CDN instead of turning one into a red build.
const FONT_FETCH_TIMEOUT_MS = 120_000;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "typstmd-render-"));
  if (!NETWORK) return;
  fontsDir = join(tmpDir, "fonts");
  mkdirSync(fontsDir, { recursive: true });
  const dir = fontsDir;
  await Promise.all(
    [...Object.values(FONT_URLS).flat(), EMOJI_FONT.url].map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) return;
      writeFileSync(join(dir, url.split("/").pop()!), new Uint8Array(await res.arrayBuffer()));
    }),
  );
}, FONT_FETCH_TIMEOUT_MS);

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
  const { typstSource } = markdownToTypst(markdown, { themeId });
  const srcPath = join(tmpDir, `${themeId}-${Math.abs(hash(markdown))}.typ`);
  const pdfPath = srcPath.replace(/\.typ$/, ".pdf");
  writeFileSync(srcPath, typstSource, "utf-8");

  const args = ["compile", "--ignore-system-fonts"];
  // CDN faces (theme fonts by URL, emoji) live in the browser; the CLI reads them from disk when fetched.
  if (fontsDir) args.push("--font-path", fontsDir);
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

  it("gives a table cell's inline code somewhere to break in a narrow column", () => {
    // A third-party template has no ZWSP show rule of its own, so the break opportunities have to be in the content. Measured on this page at 95pt columns: the widest word is 193pt without the breaks and 139pt with them, so the threshold sits between the two.
    const md = "| | |\n|---|---|\n| **Document type / version** | Report v1.26 |\n| **Targets** | extranet (`xmldev.dotwconnect.com`) |\n";
    const { typstSource } = markdownToTypst(md, {
      templateOverride: '#set page(width: 9cm, height: 12cm, margin: 1cm, columns: 2)\n#set text(font: "Libertinus Serif", size: 10pt)',
    });
    const srcPath = join(tmpDir, "narrow-column.typ");
    const pdfPath = join(tmpDir, "narrow-column.pdf");
    writeFileSync(srcPath, typstSource, "utf-8");
    expect(spawnSync("typst", ["compile", "--ignore-system-fonts", srcPath, pdfPath], { encoding: "utf-8" }).status).toBe(0);

    const bbox = execFileSync("pdftotext", ["-bbox", "-f", "1", "-l", "1", pdfPath, "-"], { stdio: "pipe" }).toString();
    const rightEdges = [...bbox.matchAll(/xMax="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.max(...rightEdges)).toBeLessThan(160);
  });

  it("injects merman for a mermaid block while keeping the fence source", () => {
    const { typstSource } = markdownToTypst('Before.\n\n```mermaid\nxychart-beta\n  bar [2, 1, 3]\n```\n\nAfter.\n');
    expect(typstSource).toContain("@preview/merman");
    expect(typstSource).toContain("show-mermaid-blocks");
    // The fence text must survive serialization for merman to parse it at compile time.
    expect(typstSource).toContain("xychart-beta");
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

  // A theme naming only embedded faces compiles offline; one naming a CDN face needs those fetched first (NETWORK). Either way, assert each named face lands in the PDF, not a fallback.
  for (const theme of themes) {
    const named = namedFonts(theme.template);
    const needsNet = named.some((f) => !EMBEDDED.includes(f));
    it.if(!needsNet || NETWORK)(`${theme.id}: names no font it cannot load`, () => {
      const { stderr, fonts } = render("# Title\n\nBody with `code`.\n", theme.id);
      expect(stderr).not.toContain("unknown font family");
      for (const family of named) {
        expect(fonts).toContain(EMBEDDED_AS[family] ?? family);
      }
    });
  }

  // Needs the package registry (the one unavoidable network dependency); CI sets TYPSTMD_NETWORK_TESTS=1, locally it is opt-in.
  describe.if(NETWORK)("universe starters compile", () => {
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

  // Downloads the merman package, so opt-in. The injection is theme-agnostic, so the plain theme exercises it; a regressed show rule would print the fence source, hence the assertion.
  it.if(NETWORK)("draws mermaid fences instead of printing their source", () => {
    const md = '# Charts\n\n```mermaid\npie showData title Sev\n  "High" : 1\n  "Medium" : 1\n```\n';
    const { text } = render(md, "default");
    expect(text).not.toContain("showData");
  });

  it.if(NETWORK)("embeds the emoji face only when the document has emoji", () => {
    const withEmoji = render("Shipping :rocket: today.\n");
    expect(withEmoji.fonts).toContain("NotoColorEmoji");
    expect(withEmoji.stderr).not.toContain("unknown font family");

    const without = render("Shipping today.\n");
    expect(without.fonts).not.toContain("NotoColorEmoji");
  });
});
