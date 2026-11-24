import compilerPackage from "@myriaddreamin/typst-ts-web-compiler/package.json";
import { BROTLI_SUFFIX, COMPILER_WASM } from "./compiler-wasm";

// Auto-compile runs on every keystroke, so every fetch here is memoised by URL and spec.
// An unmemoised prefetch would re-download packages and images while the user types.

const IMAGE_URL_PATTERN = /!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)/g;
const PACKAGE_SPEC_PATTERN = /@preview\/([A-Za-z0-9_-]+):(\d+\.\d+\.\d+)/g;

/** Typst picks a decoder from the file extension, so a URL's extension cannot be trusted. */
const MAGIC: { bytes: number[]; ext: string }[] = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], ext: "png" },
  { bytes: [0xff, 0xd8, 0xff], ext: "jpg" },
  { bytes: [0x47, 0x49, 0x46, 0x38], ext: "gif" },
  { bytes: [0x52, 0x49, 0x46, 0x46], ext: "webp" },
];

export interface Asset {
  path: string;
  bytes: Uint8Array;
}

export function scanImageUrls(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(IMAGE_URL_PATTERN)].map((m) => m[1]))];
}

export function scanPackageSpecs(source: string): string[] {
  return [...new Set([...source.matchAll(PACKAGE_SPEC_PATTERN)].map((m) => `${m[1]}:${m[2]}`))];
}

function sniffExtension(bytes: Uint8Array): string | undefined {
  for (const { bytes: magic, ext } of MAGIC) {
    if (magic.every((byte, i) => bytes[i] === byte)) return ext;
  }
  const head = new TextDecoder().decode(bytes.slice(0, 64)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";
  return undefined;
}

function assetPath(url: string, ext: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  return `/assets/${(hash >>> 0).toString(36)}.${ext}`;
}

const imageCache = new Map<string, Asset | null>();

// A null entry is usually a host without CORS headers, which no browser can read; the caller must warn.
export async function fetchImages(urls: string[]): Promise<Map<string, Asset | null>> {
  await Promise.all(
    urls
      .filter((url) => !imageCache.has(url))
      .map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            imageCache.set(url, null);
            return;
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          const ext = sniffExtension(bytes);
          imageCache.set(url, ext ? { path: assetPath(url, ext), bytes } : null);
        } catch {
          imageCache.set(url, null);
        }
      }),
  );

  return new Map(urls.map((url) => [url, imageCache.get(url) ?? null]));
}

const packageCache = new Map<string, Uint8Array>();

export function packageUrl(spec: string): string {
  const [name, version] = spec.split(":");
  return `https://packages.typst.org/preview/${name}-${version}.tar.gz`;
}

/** Warms the cache the prefetch registry reads, off the main thread's critical path. */
export async function fetchPackages(specs: string[]): Promise<Map<string, Uint8Array>> {
  await Promise.all(
    specs
      .map(packageUrl)
      .filter((url) => !packageCache.has(url))
      .map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return;
          packageCache.set(url, new Uint8Array(await response.arrayBuffer()));
        } catch {
          /* the registry falls back to its own fetch, and Typst reports an unresolved import */
        }
      }),
  );
  return packageCache;
}

export function packageCacheRef(): Map<string, Uint8Array> {
  return packageCache;
}

// Resolved relative so it works under any base path; document.baseURI on the main thread, self.location in a worker.
// The final fallback keeps module load from throwing under the test runner, where neither global exists; the URL is unused there.
export const WASM_URL = new URL(
  `./${COMPILER_WASM}`,
  typeof document !== "undefined"
    ? document.baseURI
    : typeof self !== "undefined" && self.location
      ? self.location.href
      : "http://localhost/",
).href;

// The compiler is kept in Cache Storage, not left to the HTTP cache: WebKit does not keep the 28 MB module there and re-downloaded 10.9 MB on every visit (measured in Playwright WebKit with a persistent profile: 20 s per warm load, against 0.3 s in Chromium).
// The name carries the compiler version because WASM_URL does not: an old module served to the new JS glue would fail to instantiate.
export const WASM_CACHE_PREFIX = "typstmd-compiler-";
export const WASM_CACHE = `${WASM_CACHE_PREFIX}${compilerPackage.version}`;

// openWasmCache returns null where Cache Storage is missing (an insecure origin, the test runner) or refused (a private window), and the compiler then comes from the network as before.
async function openWasmCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  return caches.open(WASM_CACHE).catch(() => null);
}

function decodesBrotli(): boolean {
  try {
    new DecompressionStream("brotli" as CompressionFormat);
    return true;
  } catch {
    return false;
  }
}

// downloadCompilerWasm takes the brotli copy build.ts writes beside the module (7.1 MB against 10.7 MB gzipped) when the browser can decode it.
// GitHub Pages serves gzip only and ignores a precompressed `.br`, so the browser decodes it here; Chromium 151 cannot (measured) and keeps the gzip path.
// A missing `.br` (the dev server, an older deploy) falls back to the module itself.
async function downloadCompilerWasm(): Promise<Response> {
  if (decodesBrotli()) {
    const br = await fetch(WASM_URL + BROTLI_SUFFIX).catch(() => null);
    if (br?.ok && br.body) {
      return new Response(br.body.pipeThrough(new DecompressionStream("brotli" as CompressionFormat)), {
        headers: { "content-type": "application/wasm" },
      });
    }
  }
  return fetch(WASM_URL);
}

// fetchCompilerWasm is what the compiler loads its module from, in the worker and in the main-thread fallback alike.
export async function fetchCompilerWasm(): Promise<Response> {
  const cache = await openWasmCache();
  const cached = await cache?.match(WASM_URL).catch(() => undefined);
  if (cached) return cached;
  const response = await downloadCompilerWasm();
  if (cache && response.ok) cache.put(WASM_URL, response.clone()).catch(() => {});
  return response;
}

// prefetchCompilerWasm stores the compiler before the first compile so that compile's timeout never races a slow download.
// onProgress reports MB, not %: content-length is the gzipped size but the drained body is decompressed bytes, so the total is unknown here.
export async function prefetchCompilerWasm(onProgress?: (mb: number) => void): Promise<void> {
  const cache = await openWasmCache();
  if (await cache?.match(WASM_URL).catch(() => undefined)) return;

  const res = await downloadCompilerWasm();
  if (!res.ok || !res.body) {
    await res.arrayBuffer().catch(() => {});
    return;
  }
  const stored = cache ? cache.put(WASM_URL, res.clone()).catch(() => {}) : Promise.resolve();
  const reader = res.body.getReader();
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    onProgress?.(Math.round(bytes / 1_048_576));
  }
  await stored;
  await dropOtherCompilerCaches();
}

async function dropOtherCompilerCaches(): Promise<void> {
  const names = await caches.keys().catch(() => [] as string[]);
  await Promise.all(names.filter((n) => n.startsWith(WASM_CACHE_PREFIX) && n !== WASM_CACHE).map((n) => caches.delete(n)));
}
