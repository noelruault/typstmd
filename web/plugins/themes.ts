/**
 * Bun plugin: scans a themes directory for *.ts files and emits a
 * `virtual:themes` module re-exporting their `themes` arrays concatenated
 * as `allThemes`. Keeps highlight/index.ts free of per-theme imports.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { BunPlugin } from "bun";

export function themesPlugin(themesDir: string): BunPlugin {
  return {
    name: "virtual-themes",
    setup(build) {
      build.onResolve({ filter: /^virtual:themes$/ }, (args) => ({
        path: args.path,
        namespace: "virtual-themes",
      }));
      build.onLoad({ filter: /.*/, namespace: "virtual-themes" }, () => {
        const files = readdirSync(themesDir)
          .filter((f) => f.endsWith(".ts"))
          .sort();
        const imports = files
          .map((f, i) => `import { themes as t${i} } from ${JSON.stringify(join(themesDir, f))};`)
          .join("\n");
        const spread = files.map((_, i) => `...t${i}`).join(", ");
        return {
          contents: `${imports}\nexport const allThemes = [${spread}];\n`,
          loader: "ts",
        };
      });
    },
  };
}
