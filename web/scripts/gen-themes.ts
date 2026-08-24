// Regenerates src/themes/registry.gen.ts. Run via `bun run gen:themes` and on `prepare` (bun install), so a fresh clone typechecks before any build.
import { join } from "node:path";
import { generateContentThemesRegistry } from "../plugins/content-themes";

generateContentThemesRegistry(join(import.meta.dir, "..", "src/themes"));
