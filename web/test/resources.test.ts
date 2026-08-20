import { describe, it, expect } from "bun:test";
import { scanImageUrls, scanPackageSpecs, packageUrl, fetchImages } from "../src/resources";

describe("scanning", () => {
  it("finds remote image urls and ignores local paths", () => {
    const md = "![a](https://x.test/a.png)\n\n![b](./local.png)\n\n![c](http://y.test/c.jpg)";
    expect(scanImageUrls(md)).toEqual(["https://x.test/a.png", "http://y.test/c.jpg"]);
  });

  it("deduplicates repeated urls so one fetch covers them", () => {
    const md = "![a](https://x.test/a.png) ![again](https://x.test/a.png)";
    expect(scanImageUrls(md)).toEqual(["https://x.test/a.png"]);
  });

  it("finds pinned package specs and ignores unversioned imports", () => {
    const source = '#import "@preview/basic-resume:0.2.9": *\n#import "@preview/nope": *';
    expect(scanPackageSpecs(source)).toEqual(["basic-resume:0.2.9"]);
  });

  it("deduplicates package specs", () => {
    const source = '@preview/a:1.0.0 @preview/a:1.0.0 @preview/b:2.1.3';
    expect(scanPackageSpecs(source)).toEqual(["a:1.0.0", "b:2.1.3"]);
  });

  it("builds the registry url typst.ts expects", () => {
    expect(packageUrl("basic-resume:0.2.9")).toBe(
      "https://packages.typst.org/preview/basic-resume-0.2.9.tar.gz",
    );
  });
});

describe("image fetching", () => {
  it("fetches each url once, however many compiles ask for it", async () => {
    const url = "https://memo.test/pic.png";
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls++;
      // PNG magic, so the extension is sniffed rather than taken from the url.
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
      return new Response(bytes, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const first = await fetchImages([url]);
      const second = await fetchImages([url]);
      expect(calls).toBe(1);
      expect(first.get(url)?.path).toMatch(/^\/assets\/[a-z0-9]+\.png$/);
      expect(second.get(url)?.path).toBe(first.get(url)!.path);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("reports null for an unreadable host instead of inventing a path", async () => {
    const url = "https://blocked.test/pic.png";
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    try {
      const result = await fetchImages([url]);
      expect(result.get(url)).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects bytes it cannot identify, since Typst decodes by extension", async () => {
    const url = "https://weird.test/pic.png";
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })) as unknown as typeof fetch;

    try {
      const result = await fetchImages([url]);
      expect(result.get(url)).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});
