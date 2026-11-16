import { describe, it, expect, afterEach } from "bun:test";
import { tolerantFontFetch } from "../src/font-fetch";

const realFetch = globalThis.fetch;
const realLocation = globalThis.location;

function stubFetch(answer: () => Promise<Response>) {
  globalThis.fetch = (() => answer()) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.location = realLocation;
});

describe("tolerantFontFetch", () => {
  it("passes a font that loads through unchanged", async () => {
    stubFetch(async () => new Response(new Uint8Array([1, 2, 3])));
    const body = await (await tolerantFontFetch("https://cdn.example/A.ttf")).arrayBuffer();
    expect(new Uint8Array(body)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("answers an unreachable remote font with an empty body instead of rejecting", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const body = await (await tolerantFontFetch("https://nonexistent.invalid/A.ttf")).arrayBuffer();
    expect(body.byteLength).toBe(0);
  });

  it("drops an error page rather than handing it to Typst as a font", async () => {
    stubFetch(async () => new Response("<html>404</html>", { status: 404 }));
    const body = await (await tolerantFontFetch("https://cdn.example/missing.ttf")).arrayBuffer();
    expect(body.byteLength).toBe(0);
  });

  it("still rejects for our own origin, where a missing baseline face must not pass silently", async () => {
    globalThis.location = { href: "https://app.example/typstmd/", origin: "https://app.example" } as Location;
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(tolerantFontFetch("https://app.example/typstmd/fonts/A.otf")).rejects.toThrow("Failed to fetch");
  });
});
