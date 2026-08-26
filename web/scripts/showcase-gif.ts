// Regenerates docs/report-template.gif. `bun run gif` from web/; needs typst, pdftoppm and ffmpeg on PATH.
// Panels are aligned by anchoring every heading on both sides and asking Typst where it landed: scrolling at a fixed rate drifts, because the cover and contents pages have no body markdown behind them.

import { execFileSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { markdownToTypst } from "../src/pipeline";
import { FONT_URLS } from "../src/themes";

const THEME = "typstmd";
const REPO = join(import.meta.dir, "../..");
const SOURCE_MD = join(REPO, "web/test/visuals/branded-report.md");
const OUT_GIF = join(REPO, "docs/report-template.gif");

const DPI = 110;
const PANEL_W = 520; // per panel, so the GIF is ~1066px wide
const SECONDS_PER_PAGE = 1.5;
const LEAD_IN_PX = 45; // a heading sits just below the window's top edge, not flush against it
const COLORS = 128; // 64 flattens the severity pill tints

function requireTool(bin: string, args: string[]) {
  if (spawnSync(bin, args, { stdio: "pipe" }).error) {
    console.error(`${bin} is required and not on PATH`);
    process.exit(1);
  }
}

const work = join(tmpdir(), "typstmd-gif");
const fontsDir = join(work, "fonts");

function typst(args: string[]): string {
  return execFileSync("typst", [args[0], "--ignore-system-fonts", "--font-path", fontsDir, "--root", work, ...args.slice(1)], {
    encoding: "utf-8",
  });
}

/** Values of every `<label>` metadata element, in document order. */
function query<T>(file: string, label: string): T[] {
  return JSON.parse(typst(["query", file, label, "--field", "value"]));
}

function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/** The markdown rendered one line per row, so a heading's own y offset can be measured. */
function sourcePanel(md: string): string {
  const rows = md.split("\n").map((line) => {
    const literal = line.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const anchor = /^#{1,6} /.test(line)
      ? `#context [#metadata((h: "${line.replace(/^#+ /, "").replace(/"/g, "")}", y: here().position().y.pt()))<hy>]`
      : "";
    return `${anchor}#raw("${literal}")\\`;
  });
  return [
    `#set page(width: 8.5in, height: auto, margin: (x: 0.55in, y: 0.45in), fill: rgb("#fbfaff"))`,
    `#set text(font: "DejaVu Sans Mono", size: 11pt, fill: rgb("#2b2b33"))`,
    `#set par(leading: 0.55em, spacing: 0.55em, justify: false)`,
    `#show raw: it => {`,
    `  show regex("^#{1,6} .*$"): m => text(fill: rgb("#6b51ff"), weight: "bold", m.text)`,
    "  show regex(\"^```.*$\"): m => text(fill: rgb(\"#a3008c\"), m.text)",
    `  show regex("^\\\\|.*$"): m => text(fill: rgb("#585273"), m.text)`,
    `  show regex("^(-|\\\\d+\\\\.) .*$"): m => text(fill: rgb("#0a5f9e"), m.text)`,
    `  show regex("^> .*$"): m => text(fill: rgb("#2f7a45"), m.text)`,
    `  it`,
    `}`,
    ...rows,
  ].join("\n");
}

requireTool("typst", ["--version"]);
requireTool("pdftoppm", ["-v"]);
requireTool("ffmpeg", ["-version"]);

rmSync(work, { recursive: true, force: true });
mkdirSync(fontsDir, { recursive: true });

// The theme names Barlow and Montserrat, which the browser fetches by URL rather than embedding.
for (const url of Object.values(FONT_URLS).flat()) {
  const dest = join(fontsDir, url.split("/").pop()!);
  if (existsSync(dest)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  writeFileSync(dest, new Uint8Array(await res.arrayBuffer()));
}

const md = readFileSync(SOURCE_MD, "utf-8");
const { typstSource } = markdownToTypst(md, { themeId: THEME });

// Right: which page did each heading land on?
const anchored = typstSource
  .split("\n")
  .map((l) =>
    /^=+ /.test(l)
      ? `#context [#metadata((h: "${l.replace(/^=+ /, "").replace(/"/g, "")}", p: here().page()))<hp>]\n${l}`
      : l,
  )
  .join("\n");
writeFileSync(join(work, "report.typ"), anchored, "utf-8");
const landed = query<{ h: string; p: number }>(join(work, "report.typ"), "<hp>");
typst(["compile", join(work, "report.typ"), join(work, "report.pdf")]);

// Left: where does each heading sit in the source strip?
writeFileSync(join(work, "source.typ"), sourcePanel(md), "utf-8");
const offsets = new Map(query<{ h: string; y: number }>(join(work, "source.typ"), "<hy>").map((o) => [o.h, o.y]));
typst(["compile", join(work, "source.typ"), join(work, "source.pdf")]);

execFileSync("pdftoppm", ["-png", "-r", String(DPI), join(work, "report.pdf"), join(work, "page")]);
execFileSync("pdftoppm", ["-png", "-r", String(DPI), join(work, "source.pdf"), join(work, "strip")]);

const strip = join(work, "strip-1.png");
const pageCount = Math.max(...landed.map((l) => l.p));
const { h: stripH } = pngSize(strip);
const { h: winH } = pngSize(join(work, "page-1.png"));

const firstHeadingOn = new Map<number, string>();
for (const { h, p } of landed) if (!firstHeadingOn.has(p)) firstHeadingOn.set(p, h);

let y = 0;
for (let page = 1; page <= pageCount; page++) {
  // A page with no heading of its own (the cover, the contents) holds the previous offset.
  const heading = firstHeadingOn.get(page);
  if (heading && offsets.has(heading)) {
    y = Math.max(0, Math.min(Math.round((offsets.get(heading)! * DPI) / 72) - LEAD_IN_PX, stripH - winH));
  }
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", strip,
    "-i", join(work, `page-${page}.png`),
    "-filter_complex",
    `[0:v]crop=${pngSize(strip).w}:${winH}:0:${y},scale=${PANEL_W}:-1[l];` +
      `[1:v]scale=${PANEL_W}:-1,pad=iw+2:ih:2:0:color=0xd5d0e8[r];` +
      `[l][r]hstack=inputs=2,pad=iw+24:ih+24:12:12:color=white`,
    "-frames:v", "1",
    join(work, `frame-${page}.png`),
  ]);
  console.log(`page ${String(page).padStart(2)}  y=${String(y).padStart(5)}  ${heading ?? "(front matter, holds top)"}`);
}

mkdirSync(join(REPO, "docs"), { recursive: true });
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-framerate", `1/${SECONDS_PER_PAGE}`,
  "-start_number", "1",
  "-i", join(work, "frame-%d.png"),
  "-vf", `split[a][b];[a]palettegen=max_colors=${COLORS}[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`,
  "-loop", "0",
  OUT_GIF,
]);

const kb = Math.round(readFileSync(OUT_GIF).byteLength / 1024);
console.log(`\nwrote ${OUT_GIF} (${pageCount} frames, ${kb} KB)`);
