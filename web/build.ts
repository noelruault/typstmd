/**
 * Production bundle entry. Invoked via `bun run build` (see package.json).
 */

import { join } from "node:path";
import { themesPlugin } from "./plugins/themes";

const ROOT = import.meta.dir;

const result = await Bun.build({
  entrypoints: [join(ROOT, "src/main.ts")],
  outdir: join(ROOT, "dist"),
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
