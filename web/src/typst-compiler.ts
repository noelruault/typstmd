/**
 * Wrapper around @myriaddreamin/typst.ts WASM compiler.
 * All typst.ts imports are confined to this file.
 */

import {
  createTypstCompiler,
  preloadRemoteFonts,
  initOptions,
  MemoryAccessModel,
  FetchPackageRegistry,
} from "@myriaddreamin/typst.ts";
import { packageCacheRef, WASM_URL } from "./resources";

export interface TypstCompiler {
  init(): Promise<void>;
  compile(source: string): Promise<Uint8Array>;
  getErrors(): string[];
  /** Puts binary files in the VFS so `image("/assets/…")` resolves. */
  mapAssets(assets: Iterable<{ path: string; bytes: Uint8Array }>): void;
}

/**
 * Where package tarballs come from. `prefetch` reads bytes fetched asynchronously before
 * the compile; `sync-xhr` lets typst.ts fetch them itself, blocking the main thread.
 */
export type PackageStrategy = "prefetch" | "sync-xhr";

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

// Reads the cache resources.ts warms, so a compile does no network I/O on the main thread.
// Falls back to the base class's synchronous XHR when a spec was never prefetched, which blocks the UI but still renders rather than failing the import.
class PrefetchedPackageRegistry extends FetchPackageRegistry {
  pullPackageData(spec: Parameters<FetchPackageRegistry["pullPackageData"]>[0]) {
    return packageCacheRef().get(this.resolvePath(spec)) ?? super.pullPackageData(spec);
  }
}

export function createCompiler(
  fonts: FontSpec = DEFAULT_FONTS,
  packageStrategy: PackageStrategy = "prefetch",
): TypstCompiler {
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

      const accessModel = new MemoryAccessModel();
      const registry =
        packageStrategy === "prefetch"
          ? new PrefetchedPackageRegistry(accessModel)
          : new FetchPackageRegistry(accessModel);

      performance.mark("compiler-init-start");
      await inner.init({
        getModule: () => wasmReady,
        beforeBuild: [
          preloadRemoteFonts(fonts.urls, { assets: fonts.assets }),
          initOptions.withAccessModel(accessModel),
          initOptions.withPackageRegistry(registry),
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

      // 1 is CompileFormatEnum.pdf; 0.7.0 stopped re-exporting the enum, so the value is inlined.
      const raw: unknown = await inner.compile({
        mainFilePath: "/main.typ",
        format: 1 as never,
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

    mapAssets(assets) {
      for (const { path, bytes } of assets) {
        inner.mapShadow(path, bytes);
      }
    },
  };
}

function instanceSignature(fonts: FontSpec, packageStrategy: PackageStrategy): string {
  return `${[...fonts.assets].sort().join(",")}|${[...fonts.urls].sort().join(",")}|${packageStrategy}`;
}

const instances = new Map<string, TypstCompiler>();

// getCompiler is called on every compile: each cache miss pays a full WASM init plus font parsing.
export async function getCompiler(
  fonts: FontSpec = DEFAULT_FONTS,
  packageStrategy: PackageStrategy = "prefetch",
): Promise<TypstCompiler> {
  const key = instanceSignature(fonts, packageStrategy);
  let instance = instances.get(key);
  if (!instance) {
    instance = createCompiler(fonts, packageStrategy);
    instances.set(key, instance);
  }
  await instance.init();
  return instance;
}
