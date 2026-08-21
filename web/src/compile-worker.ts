/// <reference lib="webworker" />
// Runs the WASM compile off the main thread. A document that OOMs or loops kills only this worker, and the main thread's timeout (compile-client.ts) reclaims it, so the UI never freezes.

import { getCompiler } from "./typst-compiler";
import type { FontSpec, PackageStrategy } from "./typst-compiler";

interface CompileMessage {
  id: number;
  source: string;
  fonts: FontSpec;
  packageStrategy: PackageStrategy;
  assets: { path: string; bytes: Uint8Array }[];
}

const post = (self as unknown as Worker).postMessage.bind(self);

self.onmessage = async (event: MessageEvent<CompileMessage>) => {
  const { id, source, fonts, packageStrategy, assets } = event.data;
  let compiler: Awaited<ReturnType<typeof getCompiler>> | null = null;
  try {
    compiler = await getCompiler(fonts, packageStrategy);
    compiler.mapAssets(assets);
    const pdfBytes = await compiler.compile(source);
    post({ id, pdfBytes }, [pdfBytes.buffer]);
  } catch (err) {
    const errors = compiler?.getErrors() ?? [];
    const error = errors.length
      ? errors.join("; ")
      : err instanceof Error
        ? err.message
        : String(err);
    post({ id, error });
  }
};
