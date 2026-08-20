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
