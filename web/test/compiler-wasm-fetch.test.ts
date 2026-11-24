import { describe, it, expect, afterEach } from "bun:test";
import { brotliCompressSync } from "node:zlib";
import { prefetchCompilerWasm, fetchCompilerWasm, WASM_URL, WASM_CACHE } from "../src/resources";
import { BROTLI_SUFFIX } from "../src/compiler-wasm";

const MODULE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 42, 42, 42]);
const realFetch = globalThis.fetch;
const realCaches = (globalThis as { caches?: CacheStorage }).caches;

interface FakeServer {
  requests: string[];
}

function serve(routes: Record<string, () => Response>): FakeServer {
  const server: FakeServer = { requests: [] };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    server.requests.push(url.endsWith(BROTLI_SUFFIX) ? "br" : "wasm");
    return routes[url.endsWith(BROTLI_SUFFIX) ? "br" : "wasm"]?.() ?? new Response("nf", { status: 404 });
  }) as typeof fetch;
  return server;
}

function fakeCaches(): Map<string, Map<string, Uint8Array>> {
  const stores = new Map<string, Map<string, Uint8Array>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (url: string) => (store.has(url) ? new Response(store.get(url)!) : undefined),
      put: async (url: string, res: Response) => {
        store.set(url, new Uint8Array(await res.arrayBuffer()));
      },
    } as unknown as Cache;
  };
  (globalThis as { caches?: unknown }).caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  return stores;
}

function streamThatBreaks(): Response {
  const head = brotliCompressSync(MODULE).subarray(0, 4);
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(head);
        controller.error(new TypeError("network connection was lost"));
      },
    }),
  );
}

afterEach(() => {
  globalThis.fetch = realFetch;
  (globalThis as { caches?: unknown }).caches = realCaches;
});

describe("compiler module download", () => {
  it("stores the decoded brotli copy and never asks for the gzip module", async () => {
    const stores = fakeCaches();
    const server = serve({ br: () => new Response(brotliCompressSync(MODULE)) });
    await prefetchCompilerWasm();
    expect(server.requests).toEqual(["br"]);
    expect(stores.get(WASM_CACHE)?.get(WASM_URL)).toEqual(MODULE);
  });

  it("falls back to the module when the brotli copy is missing", async () => {
    const stores = fakeCaches();
    const server = serve({ wasm: () => new Response(MODULE) });
    await prefetchCompilerWasm();
    expect(server.requests).toEqual(["br", "wasm"]);
    expect(stores.get(WASM_CACHE)?.get(WASM_URL)).toEqual(MODULE);
  });

  it("retries as the module when the brotli download breaks halfway", async () => {
    const stores = fakeCaches();
    const server = serve({ br: streamThatBreaks, wasm: () => new Response(MODULE) });
    await prefetchCompilerWasm();
    expect(server.requests).toEqual(["br", "wasm"]);
    expect(stores.get(WASM_CACHE)?.get(WASM_URL)).toEqual(MODULE);
  });

  it("serves the stored module afterwards without touching the network", async () => {
    fakeCaches();
    serve({ br: () => new Response(brotliCompressSync(MODULE)) });
    await prefetchCompilerWasm();
    const server = serve({});
    expect(new Uint8Array(await (await fetchCompilerWasm()).arrayBuffer())).toEqual(MODULE);
    expect(server.requests).toEqual([]);
  });

  it("drops a previous compiler version once the new one is stored", async () => {
    const stores = fakeCaches();
    stores.set("typstmd-compiler-0.0.1", new Map([[WASM_URL, MODULE]]));
    serve({ br: () => new Response(brotliCompressSync(MODULE)) });
    await prefetchCompilerWasm();
    expect([...stores.keys()]).toEqual([WASM_CACHE]);
  });

  it("downloads gzip only where Cache Storage is missing, since the worker refetches it anyway", async () => {
    (globalThis as { caches?: unknown }).caches = undefined;
    const server = serve({ br: () => new Response(brotliCompressSync(MODULE)), wasm: () => new Response(MODULE) });
    await prefetchCompilerWasm();
    expect(server.requests).toEqual(["wasm"]);
  });
});
