// Regenerates src/themes/registry.gen.ts before tests; themes/index.ts imports it, and the bundler generates it only for dev-server/build.
import { join } from "node:path";
import { generateContentThemesRegistry } from "./plugins/content-themes";

generateContentThemesRegistry(join(import.meta.dir, "src/themes"));
