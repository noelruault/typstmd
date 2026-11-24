// The site serves the compiler module under the file name the package ships it with; build.ts, the dev server and resources.ts all take it from here.
// build.ts fails if the package renames the file, so a rename cannot ship a site that 404s its compiler.
export const COMPILER_WASM_SPECIFIER = "@myriaddreamin/typst-ts-web-compiler/wasm";
export const COMPILER_WASM = "typst_ts_web_compiler_bg.wasm";

// BROTLI_SUFFIX names the precompressed copy build.ts writes beside the module.
export const BROTLI_SUFFIX = ".br";
