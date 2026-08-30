/**
 * Bun dev server for typstmd-web.
 *
 * Bundles src/main.ts on startup with Bun.build(), then serves the bundle
 * alongside index.html and WASM files. Sets COOP/COEP headers required
 * for SharedArrayBuffer (used by the typst WASM compiler).
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { themesPlugin } from "../plugins/themes";
import { generateContentThemesRegistry } from "../plugins/content-themes";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, ".dev-dist");
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

const SECURITY_HEADERS: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

generateContentThemesRegistry(join(ROOT, "src/themes"));

// Bundle src/main.ts
async function bundle(): Promise<boolean> {
  console.log("Bundling src/main.ts...");
  const result = await Bun.build({
    entrypoints: [join(ROOT, "src/main.ts"), join(ROOT, "src/compile-worker.ts")],
    outdir: DIST,
    target: "browser",
    format: "esm",
    sourcemap: "inline",
    plugins: [themesPlugin(join(ROOT, "src/highlight/themes"))],
    // Bun.build throws on compile errors by default; report them and keep serving instead.
    throw: false,
  });
  if (!result.success) {
    console.error("Bundle failed:");
    for (const log of result.logs) {
      console.error(log);
    }
  } else {
    console.log("Bundle complete.");
  }
  return result.success;
}

if (!(await bundle())) process.exit(1);
let bundledAt = Date.now();

// Rebundle when a source file is newer than the bundle. The old `bun run dev --watch` never
// worked: --watch landed in this script's argv rather than bun's, and even as bun's flag it
// would not have helped, because the server bundles main.ts rather than importing it, so no
// change to src/ ever restarted the process. Staleness is checked when the bundle itself is
// requested; a broken edit logs the compile error and serves the last good bundle instead of
// killing the server mid-session.
function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs);
  }
  return newest;
}

async function ensureFreshBundle(): Promise<void> {
  const newest = Math.max(newestMtime(join(ROOT, "src")), newestMtime(join(ROOT, "plugins")));
  if (newest <= bundledAt) return;
  generateContentThemesRegistry(join(ROOT, "src/themes"));
  if (await bundle()) bundledAt = Date.now();
}

// Rewrite index.html to point to the bundled JS instead of src/main.ts
function getIndexHtml(): string {
  const raw = Bun.file(join(ROOT, "index.html")).text();
  return raw.then((html) =>
    html.replace(
      '<script type="module" src="/src/main.ts"></script>',
      '<script type="module" src="/main.js"></script>',
    ),
  ) as unknown as string;
}

const indexHtml = await getIndexHtml();

function respond(body: BodyInit, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...SECURITY_HEADERS },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Root → index.html
    if (pathname === "/") {
      return respond(indexHtml, "text/html");
    }

    // Bundled JS from .dev-dist/, rebundled first if src/ or plugins/ changed since.
    if (pathname === "/main.js" || pathname === "/compile-worker.js") {
      await ensureFreshBundle();
      const file = Bun.file(join(DIST, pathname));
      if (await file.exists()) {
        return respond(await file.text(), "application/javascript");
      }
    }

    // WASM files from node_modules. Two distinct binaries live behind .wasm paths now, so route
    // by filename: the renderer first, then the compiler as the fallback for any other .wasm.
    if (pathname.endsWith("typst_ts_renderer_bg.wasm")) {
      const rendererPath = join(
        ROOT,
        "node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
      );
      if (existsSync(rendererPath)) {
        return respond(await Bun.file(rendererPath).arrayBuffer(), "application/wasm");
      }
    }
    if (pathname.endsWith(".wasm")) {
      const wasmPath = join(
        ROOT,
        "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
      );
      if (existsSync(wasmPath)) {
        return respond(
          await Bun.file(wasmPath).arrayBuffer(),
          "application/wasm",
        );
      }
    }

    // Static files from root
    const filePath = join(ROOT, pathname);
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      return respond(await Bun.file(filePath).arrayBuffer(), mime);
    }

    // Static files from dist
    const distPath = join(DIST, pathname);
    if (existsSync(distPath)) {
      const ext = extname(distPath);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      return respond(await Bun.file(distPath).arrayBuffer(), mime);
    }

    return new Response("Not Found", {
      status: 404,
      headers: SECURITY_HEADERS,
    });
  },
});

console.log(`typstmd dev server: http://localhost:${PORT}`);
