// Renders the compiler's vector output to an SVG string on the main thread.
//
// The preview used to be `iframe.src = <pdf blob>`, which delegates to whatever PDF viewer the browser ships: desktop shows the document, iOS WebKit shows a frozen snapshot of page one, and Chrome on Android shows a download prompt because its PDF viewer only handles top-level navigations.
// Rendering the document ourselves gives every platform the same scrollable preview.
//
// The renderer needs no fonts: glyph outlines are embedded in the vector artifact by the compiler.
import { createTypstRenderer } from "@myriaddreamin/typst.ts/dist/esm/renderer.mjs";
import { PAGE_GAP, pageOffsets } from "./preview-fit";

const SVG_NS = "http://www.w3.org/2000/svg";

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

// separatePages cuts the document into visible pages: the renderer stacks them edge to edge in one coordinate space, which scrolls as one endless sheet.
// The white background has to move to a rect per page, or the gap is paper too.
export function separatePages(svg: SVGSVGElement, gap: number = PAGE_GAP): void {
  const pages = Array.from(svg.querySelectorAll<SVGGElement>(".typst-page"));
  if (pages.length === 0) return;

  const heights = pages.map((page) => Number(page.getAttribute("data-page-height")) || 0);
  const { offsets, totalHeight } = pageOffsets(heights, gap);

  pages.forEach((page, i) => {
    page.setAttribute("transform", `translate(0, ${offsets[i]})`);
    const background = document.createElementNS(SVG_NS, "rect");
    background.setAttribute("class", "typst-page-bg");
    background.setAttribute("width", page.getAttribute("data-page-width") ?? "0");
    background.setAttribute("height", String(heights[i]));
    page.prepend(background);
  });

  const width = svg.viewBox.baseVal.width;
  svg.setAttribute("viewBox", `0 0 ${width} ${totalHeight}`);
  svg.setAttribute("height", String(totalHeight));
  svg.setAttribute("data-height", String(totalHeight));
}
