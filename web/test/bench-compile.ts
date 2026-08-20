// bench.ts times only the JS transform, so a change can double compile time while it stays flat.
// `bun run test/bench-compile.ts` compares against perf-baseline.json; `--update` rewrites it.

import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { markdownToTypst } from "../src/pipeline";
import { themes } from "../src/themes";

const BASELINE_PATH = join(import.meta.dir, "perf-baseline.json");
const REPO_ROOT = join(import.meta.dir, "../..");
const RUNS = 5;

const BUDGET = { compile: 1.10, transform: 1.10 };

// Ratios on sub-millisecond work are scheduler noise, so only judge cases with room to measure.
const FLOOR_MS = { compile: 10, transform: 2 };

interface Sample {
  transformMs: number;
  compileMs: number;
}
type Results = Record<string, Sample>;

function typstAvailable(): boolean {
  try {
    execFileSync("typst", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Synthetic entry-shaped document: heading, meta line, summary, bullets, repeated. */
function syntheticDoc(entries: number): string {
  const blocks = [];
  for (let i = 0; i < entries; i++) {
    blocks.push(
      `### Role number ${i} at Company ${i}\n\n` +
        `Company ${i} · Remote, ES · 20${String(i % 20).padStart(2, "0")} – Present\n\n` +
        `Summary line for role ${i} describing scope, systems and outcomes.\n\n` +
        `- First bullet for role ${i} with enough length to give the layout engine work.\n` +
        `- Second bullet for role ${i} mentioning Kubernetes, Terraform and GitOps.\n`,
    );
  }
  return blocks.join("\n");
}

function corpus(): Record<string, string> {
  const read = (p: string) => readFileSync(join(REPO_ROOT, p), "utf-8");
  return {
    example: read("example.md"),
    "visual:headings": read("web/test/visuals/headings.md"),
    "visual:tables": read("web/test/visuals/tables.md"),
    "visual:code-blocks": read("web/test/visuals/code-blocks.md"),
    "synthetic:150-entries": syntheticDoc(150),
  };
}

function measure(md: string, themeId: string, tmpDir: string): Sample {
  const transforms: number[] = [];
  const compiles: number[] = [];
  let source = "";

  for (let run = 0; run < RUNS; run++) {
    const t0 = performance.now();
    source = markdownToTypst(md, { themeId }).typstSource;
    transforms.push(performance.now() - t0);
  }

  const srcPath = join(tmpDir, "bench.typ");
  const outPath = join(tmpDir, "bench.pdf");
  writeFileSync(srcPath, source, "utf-8");

  for (let run = 0; run < RUNS; run++) {
    const t0 = performance.now();
    // --ignore-system-fonts matches the browser font set, so timings track what users see.
    execFileSync("typst", ["compile", "--ignore-system-fonts", srcPath, outPath], { stdio: "pipe" });
    compiles.push(performance.now() - t0);
  }

  return { transformMs: median(transforms), compileMs: median(compiles) };
}

function run(): number {
  if (!typstAvailable()) {
    console.log("typst not installed, skipping compile benchmark");
    return 0;
  }

  const update = process.argv.includes("--update");
  // Report mode never fails: absolute timings are machine-specific, so a committed baseline
  // from one machine cannot gate another.
  const reportOnly = process.argv.includes("--report");
  const tmpDir = mkdtempSync(join(tmpdir(), "typstmd-bench-"));
  const results: Results = {};

  try {
    for (const [docName, md] of Object.entries(corpus())) {
      for (const theme of themes) {
        const key = `${docName} @ ${theme.id}`;
        results[key] = measure(md, theme.id, tmpDir);
      }
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  if (update || !existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(results, null, 2) + "\n", "utf-8");
    console.log(`baseline written: ${Object.keys(results).length} cases`);
    for (const [key, s] of Object.entries(results)) {
      console.log(`  ${key.padEnd(34)} transform ${s.transformMs.toFixed(1)}ms  compile ${s.compileMs.toFixed(0)}ms`);
    }
    return 0;
  }

  const baseline: Results = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  const regressions: string[] = [];

  for (const [key, sample] of Object.entries(results)) {
    const before = baseline[key];
    if (!before) {
      console.log(`  ${key.padEnd(34)} NEW  compile ${sample.compileMs.toFixed(0)}ms`);
      continue;
    }
    const compileRatio = sample.compileMs / before.compileMs;
    const transformRatio = sample.transformMs / before.transformMs;
    const overCompile = before.compileMs >= FLOOR_MS.compile && compileRatio > BUDGET.compile;
    const overTransform = before.transformMs >= FLOOR_MS.transform && transformRatio > BUDGET.transform;
    const flag = overCompile || overTransform ? "REGRESSION" : "ok";
    console.log(
      `  ${key.padEnd(34)} compile ${before.compileMs.toFixed(0)}→${sample.compileMs.toFixed(0)}ms ` +
        `(${compileRatio.toFixed(2)}x)  transform ${transformRatio.toFixed(2)}x  ${flag}`,
    );
    if (flag === "REGRESSION") {
      regressions.push(`${key}: compile ${compileRatio.toFixed(2)}x, transform ${transformRatio.toFixed(2)}x`);
    }
  }

  if (regressions.length > 0) {
    console.error(`\n${regressions.length} regression(s) over budget (compile ${BUDGET.compile}x, transform ${BUDGET.transform}x):`);
    regressions.forEach((r) => console.error(`  ${r}`));
    return reportOnly ? 0 : 1;
  }

  console.log("\nno regressions over budget");
  return 0;
}

process.exit(run());
