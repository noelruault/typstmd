/**
 * Bun dev server for typstmd-web.
 *
 * Bundles src/main.ts on startup with Bun.build(), then serves the bundle
 * alongside index.html and WASM files. Sets COOP/COEP headers required
 * for SharedArrayBuffer (used by the typst WASM compiler).
 */

import { existsSync } from "fs";
import { join, extname } from "path";
import { themesPlugin } from "../plugins/themes";

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

// Bundle src/main.ts
async function bundle() {
  console.log("Bundling src/main.ts...");
  const result = await Bun.build({
    entrypoints: [join(ROOT, "src/main.ts")],
    outdir: DIST,
    target: "browser",
    format: "esm",
    sourcemap: "inline",
    external: [
      // We only use the compiler, not the renderer. The typst.ts package
      // re-exports both; mark the renderer as external to avoid bundling it.
      "@myriaddreamin/typst-ts-renderer",
    ],
    plugins: [themesPlugin(join(ROOT, "src/highlight/themes"))],
  });
  if (!result.success) {
    console.error("Bundle failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
  console.log("Bundle complete.");
}

await bundle();

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

    // Bundled JS from .dev-dist/
    if (pathname === "/main.js") {
      const file = Bun.file(join(DIST, "main.js"));
      if (await file.exists()) {
        return respond(await file.text(), "application/javascript");
      }
    }

    // WASM files from node_modules
    if (pathname.endsWith(".wasm")) {
      // Look in node_modules for the typst WASM compiler
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
