// WebKit overflows its small worker stack on long, table-heavy documents that Chromium compiles fine, so no Chromium-only check sees the regression.
// This pins the fallback itself: a worker stack overflow must retry on the main thread, and any other error must still surface.

import { describe, it, expect, mock, beforeEach } from "bun:test";

const mainThreadCompiles: string[] = [];
mock.module("../src/typst-compiler", () => ({
  compileJob: async (job: { source: string }) => {
    mainThreadCompiles.push(job.source);
    return { pdfBytes: new Uint8Array([1]), vectorBytes: new Uint8Array([2]) };
  },
}));

let workerReply = "";
let workersSpawned = 0;
class FakeWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror = null;
  onmessageerror = null;
  constructor() {
    workersSpawned++;
  }
  postMessage(msg: { id: number }) {
    queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, error: workerReply } }));
  }
  terminate() {}
}
(globalThis as any).Worker = FakeWorker;
(globalThis as any).document = { baseURI: "http://localhost/" };

const job = (source: string) => ({ source, fonts: { assets: [], urls: [] }, packageStrategy: "sync-xhr" as const, assets: [] });

describe("compileInWorker", () => {
  beforeEach(() => {
    mainThreadCompiles.length = 0;
  });

  // Fresh module per test: the fallback is sticky for the session, which is module state.
  const load = async () => (await import(`../src/compile-client?${Math.random()}`)).compileInWorker;

  it("surfaces an ordinary compile error instead of retrying", async () => {
    const compileInWorker = await load();
    workerReply = "error: unknown variable: foo";
    await expect(compileInWorker(job("a"))).rejects.toThrow("unknown variable");
    expect(mainThreadCompiles).toEqual([]);
  });

  it("retries a worker stack overflow on the main thread, then stays there", async () => {
    const compileInWorker = await load();
    workerReply = "Maximum call stack size exceeded.";
    const result = await compileInWorker(job("big"));
    expect(result.vectorBytes).toEqual(new Uint8Array([2]));
    expect(mainThreadCompiles).toEqual(["big"]);

    const spawnedBefore = workersSpawned;
    await compileInWorker(job("next"));
    expect(mainThreadCompiles).toEqual(["big", "next"]);
    expect(workersSpawned).toBe(spawnedBefore);
  });
});
