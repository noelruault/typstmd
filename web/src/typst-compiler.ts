/**
 * Wrapper around @myriaddreamin/typst.ts WASM compiler.
 * All typst.ts imports are confined to this file.
 */

import {
  createTypstCompiler,
  preloadRemoteFonts,
} from "@myriaddreamin/typst.ts";

export interface TypstCompiler {
  init(): Promise<void>;
  compile(source: string): Promise<Uint8Array>;
  getErrors(): string[];
}

/** Fonts a compiler instance is built with. Fonts load only in `beforeBuild`, so a
 * different set means a different instance, which costs a full WASM init. */
export interface FontSpec {
  assets: ("text" | "cjk" | "emoji")[];
  urls: string[];
}

const DEFAULT_FONTS: FontSpec = { assets: ["text"], urls: [] };

/**
 * URL where the WASM binary is served. Relative so it works under any
 * base path (dev server, GitHub Pages subpath, custom domain).
 */
const WASM_URL = new URL(
  "./typst_ts_web_compiler_bg.wasm",
  document.baseURI,
).href;

function formatDiagnostics(diagnostics: unknown): string[] {
  if (!diagnostics) return ["Unknown compilation error"];
  if (typeof diagnostics === "string") return [diagnostics];
  if (Array.isArray(diagnostics)) {
    return diagnostics.map((d) => {
      if (typeof d === "string") return d;
      if (d && typeof d === "object") {
        // typst.ts diagnostics may have message/severity fields
        return d.message || JSON.stringify(d);
      }
      return String(d);
    });
  }
  if (typeof diagnostics === "object") {
    return [JSON.stringify(diagnostics)];
  }
  return [String(diagnostics)];
}

export function createCompiler(fonts: FontSpec = DEFAULT_FONTS): TypstCompiler {
  const inner = createTypstCompiler();
  let initialized = false;
  let lastErrors: string[] = [];

  return {
    async init() {
      if (initialized) return;

      performance.mark("wasm-fetch-start");
      const wasmReady = fetch(WASM_URL).then((r) => {
        performance.mark("wasm-fetch-end");
        performance.measure("wasm-fetch", "wasm-fetch-start", "wasm-fetch-end");
        return r;
      });

      performance.mark("compiler-init-start");
      await inner.init({
        getModule: () => wasmReady,
        beforeBuild: [
          preloadRemoteFonts(fonts.urls, { assets: fonts.assets }),
        ],
      });
      performance.mark("compiler-init-end");
      performance.measure("compiler-init (wasm+fonts)", "compiler-init-start", "compiler-init-end");

      initialized = true;
    },

    async compile(source: string) {
      if (!initialized) {
        throw new Error("Compiler not initialized. Call init() first.");
      }
      lastErrors = [];

      inner.addSource("/main.typ", source);

      // The compile return type depends on typst.ts version:
      // - v0.5.x may return Uint8Array directly or {result, diagnostics}
      // - v0.6.x returns CompileResult<Uint8Array, D>
      const raw: unknown = await inner.compile({
        mainFilePath: "/main.typ",
        format: "pdf",
        diagnostics: "full",
      });

      // Handle both: direct Uint8Array or wrapped {result, diagnostics}
      let pdfBytes: Uint8Array | undefined;
      let diagnostics: unknown;

      if (raw instanceof Uint8Array) {
        pdfBytes = raw;
      } else if (raw && typeof raw === "object") {
        const wrapped = raw as { result?: Uint8Array; diagnostics?: unknown };
        pdfBytes = wrapped.result;
        diagnostics = wrapped.diagnostics;
      }

      if (!pdfBytes || pdfBytes.byteLength === 0) {
        lastErrors = formatDiagnostics(diagnostics ?? raw);
        throw new Error(lastErrors.join("\n"));
      }

      return pdfBytes;
    },

    getErrors() {
      return lastErrors;
    },
  };
}

function fontSignature(fonts: FontSpec): string {
  return `${[...fonts.assets].sort().join(",")}|${[...fonts.urls].sort().join(",")}`;
}

const instances = new Map<string, TypstCompiler>();

// getCompiler is called on every compile: each cache miss pays a full WASM init plus font parsing.
export async function getCompiler(fonts: FontSpec = DEFAULT_FONTS): Promise<TypstCompiler> {
  const key = fontSignature(fonts);
  let instance = instances.get(key);
  if (!instance) {
    instance = createCompiler(fonts);
    instances.set(key, instance);
  }
  await instance.init();
  return instance;
}
