// Main-thread side of the compile worker. Owns one worker, times every job out, and terminates plus respawns on timeout or crash, so a pathological document can never freeze the UI or wedge the compiler for the next document.

import type { FontSpec, PackageStrategy } from "./typst-compiler";

export interface CompileJob {
  source: string;
  fonts: FontSpec;
  packageStrategy: PackageStrategy;
  assets: { path: string; bytes: Uint8Array }[];
}

export interface CompileResult {
  pdfBytes: Uint8Array;
  vectorBytes: Uint8Array;
}

interface WorkerReply {
  id: number;
  pdfBytes?: Uint8Array;
  vectorBytes?: Uint8Array;
  error?: string;
}

// A cold worker fetches the WASM, the fonts and (once) the merman package via sync XHR; the ceiling is generous so only a genuinely stuck compile trips it, not a first-run that is merely slow.
const TIMEOUT_MS = 45_000;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (r: CompileResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

function reclaim(message: string): void {
  for (const job of pending.values()) {
    clearTimeout(job.timer);
    job.reject(new Error(message));
  }
  pending.clear();
  worker?.terminate();
  worker = null;
}

function spawn(): Worker {
  const w = new Worker(new URL("compile-worker.js", document.baseURI), { type: "module" });
  w.onmessage = (event: MessageEvent<WorkerReply>) => {
    const { id, pdfBytes, vectorBytes, error } = event.data;
    const job = pending.get(id);
    if (!job) return;
    clearTimeout(job.timer);
    pending.delete(id);
    if (pdfBytes && vectorBytes) job.resolve({ pdfBytes, vectorBytes });
    else job.reject(new Error(error ?? "compile failed"));
  };
  w.onerror = () => reclaim("The in-browser compiler crashed; the document may be too complex.");
  w.onmessageerror = () => reclaim("The compiler worker sent a malformed message.");
  return w;
}

export function compileInWorker(job: CompileJob): Promise<CompileResult> {
  if (!worker) worker = spawn();
  const active = worker;
  const id = nextId++;
  return new Promise<CompileResult>((resolve, reject) => {
    const timer = setTimeout(
      () => reclaim("Compile timed out; the document may be too complex for the in-browser compiler."),
      TIMEOUT_MS,
    );
    pending.set(id, { resolve, reject, timer });
    active.postMessage({ id, ...job });
  });
}
