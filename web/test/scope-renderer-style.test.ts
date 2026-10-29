import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { scopeRendererStyle } from "../src/preview-fit";

// The stylesheet is compiled into the renderer, so read it from the shipped WASM: an upgrade that reformats the rule must fail here, not silently blank the toolbar icons again.
const wasm = readFileSync(
  new URL("../node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm", import.meta.url),
).toString("latin1");

describe("scopeRendererStyle", () => {
  it("still finds the global svg rule in the installed renderer", () => {
    expect(wasm).toContain("\nsvg {\n  fill: none;\n}");
  });

  it("scopes the rule to the rendered document", () => {
    const style = "<style>.pseudo-link {\n  fill: transparent;\n}\nsvg {\n  fill: none;\n}\n</style>";
    const scoped = scopeRendererStyle(style);
    expect(scoped).not.toMatch(/^svg \{/m);
    expect(scoped).toContain("svg.typst-doc, .typst-doc svg {\n  fill: none;");
  });
});
