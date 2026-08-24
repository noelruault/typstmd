/**
 * Production bundle entry. Invoked via `bun run build` (see package.json).
 *
 * Emits a self-contained static site in dist/ deployable to GitHub Pages
 * or any static host. Contents:
 *   - main.js                              bundled app
 *   - index.html                           with script src rewritten to ./main.js
 *   - typst_ts_web_compiler_bg.wasm        copied from node_modules
 *   - .nojekyll                            disables Jekyll on GitHub Pages
 *   - llms.txt                             LLM-facing site summary (llmstxt.org)
 */

import { join } from "node:path";
import { themesPlugin } from "./plugins/themes";
import { generateContentThemesRegistry } from "./plugins/content-themes";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");

generateContentThemesRegistry(join(ROOT, "src/themes"));

const result = await Bun.build({
  entrypoints: [join(ROOT, "src/main.ts"), join(ROOT, "src/compile-worker.ts")],
  outdir: DIST,
  target: "browser",
  format: "esm",
  minify: true,
  external: ["@myriaddreamin/typst-ts-renderer"],
  plugins: [themesPlugin(join(ROOT, "src/highlight/themes"))],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const indexHtml = await Bun.file(join(ROOT, "index.html")).text();
const rewritten = indexHtml.replace(
  '<script type="module" src="/src/main.ts"></script>',
  '<script type="module" src="./main.js"></script>',
);
await Bun.write(join(DIST, "index.html"), rewritten);

const wasmSrc = join(
  ROOT,
  "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
);
await Bun.write(
  join(DIST, "typst_ts_web_compiler_bg.wasm"),
  Bun.file(wasmSrc),
);

await Bun.write(join(DIST, ".nojekyll"), "");

await Bun.write(join(DIST, "llms.txt"), Bun.file(join(ROOT, "llms.txt")));

console.log(`Built static site → ${DIST}`);
