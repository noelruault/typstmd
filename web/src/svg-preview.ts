// Renders the compiler's vector output to an SVG string on the main thread.
//
// The preview used to be `iframe.src = <pdf blob>`, which delegates to whatever PDF viewer the
// browser ships: desktop shows the document, iOS WebKit shows a frozen snapshot of page one, and
// Chrome on Android shows a download prompt because its PDF viewer only handles top-level
// navigations. Rendering the document ourselves gives every platform the same scrollable preview.
//
// The renderer needs no fonts: glyph outlines are embedded in the vector artifact by the compiler.
import { createTypstRenderer } from "@myriaddreamin/typst.ts/dist/esm/renderer.mjs";

// Resolved relative for the same reason as WASM_URL in resources.ts: the site deploys under /typstmd/.
const RENDERER_WASM_URL = new URL("./typst_ts_renderer_bg.wasm", document.baseURI).href;

type Renderer = ReturnType<typeof createTypstRenderer>;
let rendererReady: Promise<Renderer> | null = null;

function getRenderer(): Promise<Renderer> {
  // A failed init is not cached, so a transient fetch failure does not wedge the preview until reload.
  if (!rendererReady) {
    const renderer = createTypstRenderer();
    rendererReady = renderer
      .init({ getModule: () => fetch(RENDERER_WASM_URL) })
      .then(() => renderer)
      .catch((err: unknown) => {
        rendererReady = null;
        throw err;
      });
  }
  return rendererReady;
}

export async function renderPreviewSvg(vectorBytes: Uint8Array): Promise<string> {
  const renderer = await getRenderer();
  const svg = await renderer.renderSvg({ artifactContent: vectorBytes, format: "vector" });
  if (typeof svg !== "string" || svg.length === 0) {
    throw new Error("The preview renderer produced no output.");
  }
  return svg;
}
