/**
 * Pipeline benchmark: measures transform throughput and memory stability.
 *
 * What we measure (code we control):
 *   - Transform time vs document size (scaling behavior)
 *   - Throughput under rapid repeated calls (simulates auto-compile)
 *   - Heap growth over many iterations (leak detection)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkEmoji from "remark-emoji";
import remarkSubSuper from "../src/remark-sub-super";
import remarkHighlight from "../src/remark-highlight";
import { mdastToTypst } from "../src/mdast-to-typst";
import { createWarningCollector } from "../src/warnings";
import { markdownToTypst } from "../src/pipeline";

const ITERATIONS = 200;

const examplePath = join(import.meta.dir, "../../example.md");
const exampleMd = readFileSync(examplePath, "utf-8");

// Documents of increasing size
const small = "# Hello\n\nA paragraph with **bold** and *italic*.";
const medium = exampleMd;
const large = Array(5).fill(exampleMd).join("\n\n---\n\n"); // ~5× example.md

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function benchTransform(label: string, md: string) {
  // Warmup
  for (let i = 0; i < 5; i++) markdownToTypst(md);

  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    markdownToTypst(md);
    times.push(performance.now() - t0);
  }

  const med = median(times).toFixed(2);
  const p99 = times.sort((a, b) => a - b)[Math.floor(ITERATIONS * 0.99)].toFixed(2);
  const ops = Math.floor(1000 / median(times));
  const chars = md.length;

  console.log(`  ${label.padEnd(12)} ${med}ms median  ${p99}ms p99  ${ops} ops/s  (${chars} chars)`);
}

// ── Scaling ──────────────────────────────────────────────────────────

console.log("Transform time vs document size:");
benchTransform("small", small);
benchTransform("medium", medium);
benchTransform("large", large);

// ── Memory stability ─────────────────────────────────────────────────

console.log("\nMemory stability (1000 iterations on medium doc):");
Bun.gc(true);
const heapBefore = process.memoryUsage().heapUsed;

for (let i = 0; i < 1000; i++) {
  markdownToTypst(medium);
}

Bun.gc(true);
const heapAfter = process.memoryUsage().heapUsed;
const deltaKB = ((heapAfter - heapBefore) / 1024).toFixed(0);
const heapMB = (heapAfter / 1024 / 1024).toFixed(1);

console.log(`  heap before: ${(heapBefore / 1024 / 1024).toFixed(1)}MB  after: ${heapMB}MB  delta: ${deltaKB}KB`);

// ── Phase breakdown ─────────────────────────────────────────────────
//
// Measures each phase independently on its own input:
//   parse        — processor.parse(md)             → MDAST tree
//   each plugin  — run one plugin on a cloned tree → mutated tree
//   serializer   — mdastToTypst(tree)              → string
//
// Plugins are measured by running each one alone via a dedicated
// processor, on a fresh clone of the parsed tree every iteration.
// This avoids the cumulative-delta approach that produces noise.

console.log("\nPhase breakdown (medium doc, 200 iterations):");

function benchPhase(label: string, fn: () => void): number {
  for (let i = 0; i < 10; i++) fn(); // warmup
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  return median(times);
}

// Parse phase: remark-parse + frontmatter + gfm (the heavy part)
const parseProc = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm, { singleTilde: false });

const medParse = benchPhase("parse", () => {
  parseProc.parse(medium);
});

// For plugin benchmarks: parse once, then run each plugin alone on a clone.
// structuredClone ensures each iteration gets a clean tree.
const baseParsed = parseProc.parse(medium);

// Each plugin measured in isolation via a single-plugin processor
const pluginDefs: { label: string; plugin: any; opts?: any }[] = [
  { label: "remark-emoji", plugin: remarkEmoji },
  { label: "remark-sub-super", plugin: remarkSubSuper },
  { label: "remark-highlight", plugin: remarkHighlight },
];

const pluginResults: { label: string; ms: number }[] = [];
for (const { label, plugin, opts } of pluginDefs) {
  const p = unified().use(plugin, opts);
  const ms = benchPhase(label, () => {
    p.runSync(structuredClone(baseParsed));
  });
  pluginResults.push({ label, ms });
}

// Serializer phase
const fullProc = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm, { singleTilde: false })
  .use(remarkEmoji)
  .use(remarkSubSuper)
  .use(remarkHighlight);
const fullTree = fullProc.runSync(fullProc.parse(medium));

const medSerialize = benchPhase("serialize", () => {
  mdastToTypst(fullTree, { warnings: createWarningCollector() });
});

// Display
const total = medParse + pluginResults.reduce((s, p) => s + p.ms, 0) + medSerialize;

function fmtPhase(label: string, ms: number, totalMs: number) {
  const pct = ((ms / totalMs) * 100).toFixed(0).padStart(3);
  return `  ${label.padEnd(22)} ${ms.toFixed(3).padStart(7)}ms  ${pct}%`;
}

console.log(fmtPhase("remark-parse + gfm", medParse, total));
for (const { label, ms } of pluginResults) {
  console.log(fmtPhase(label, ms, total));
}
console.log(fmtPhase("mdast-to-typst", medSerialize, total));
console.log(`  ${"total".padEnd(22)} ${total.toFixed(3).padStart(7)}ms`);
