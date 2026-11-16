// Under the worker's compile timeout, so a host that never answers costs one face and not the whole job.
const FONT_TIMEOUT_MS = 30_000;

// tolerantFontFetch answers a remote font that cannot be fetched with an empty body, which Typst skips.
// typst.ts loads every face in one Promise.all with no status check: without this, one dead or half-typed `// font-url:` rejects the compiler init and the document shows "Failed to fetch" instead of a fallback face.
// Our own origin stays strict: those are the baseline faces, and losing them silently renders blank pages.
export async function tolerantFontFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input);
  if (new URL(url, globalThis.location?.href).origin === globalThis.location?.origin) return fetch(input, init);

  try {
    const response = await fetch(input, { ...init, signal: AbortSignal.timeout(FONT_TIMEOUT_MS) });
    // The body is read here so a stalled download hits the timeout inside this try, not in typst.ts.
    if (response.ok) return new Response(await response.arrayBuffer());
    console.warn(`Font not loaded (HTTP ${response.status}): ${url}`);
  } catch (error) {
    console.warn(`Font not loaded (${error instanceof Error ? error.message : error}): ${url}`);
  }
  return new Response(new Uint8Array());
}
