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

/**
 * URL where the WASM binary is served. The dev server maps any .wasm
 * request to the actual file inside node_modules.
 */
const WASM_URL = "/typst_ts_web_compiler_bg.wasm";

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

export function createCompiler(): TypstCompiler {
  const inner = createTypstCompiler();
  let initialized = false;
  let lastErrors: string[] = [];

  return {
    async init() {
      if (initialized) return;
      await inner.init({
        getModule: () => fetch(WASM_URL),
        beforeBuild: [
          // Load default text fonts from GitHub CDN.
          // COEP: credentialless allows these cross-origin fetches.
          // Phase 5 will bundle Libertinus Serif locally for offline use.
          preloadRemoteFonts([], { assets: ["text"] }),
        ],
      });
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
