/// <reference lib="webworker" />
// Runs the WASM compile off the main thread. A document that OOMs or loops kills only this worker, and the main thread's timeout (compile-client.ts) reclaims it, so the UI never freezes.

import { compileJob } from "./typst-compiler";
import type { CompileJob } from "./typst-compiler";

const post = (self as unknown as Worker).postMessage.bind(self);

self.onmessage = async (event: MessageEvent<CompileJob & { id: number }>) => {
  const { id, ...job } = event.data;
  try {
    const { pdfBytes, vectorBytes } = await compileJob(job);
    post({ id, pdfBytes, vectorBytes }, [pdfBytes.buffer, vectorBytes.buffer]);
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
