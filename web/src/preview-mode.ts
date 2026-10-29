// Which preview a browser gets: its own PDF viewer in an iframe, or the SVG we render ourselves.
//
// The SVG exists because phones cannot show an `<iframe src=blob:…pdf>`: Chrome on Android offers a download, because its viewer only handles top-level navigations, and iOS WebKit freezes on page one.
// Desktop never had that problem, and the SVG costs it real text selection, the viewer's find and its print, so desktop keeps the iframe.
//
// `navigator.pdfViewerEnabled` cannot make the call on its own: measured under playwright, WebKit reports `true` on the iPhone and iPad profiles as well as desktop, and Chromium's iPad emulation reports `true` too.
// `(pointer: fine)` is what actually separates them, reading `false` on every phone and tablet profile and `true` on desktop Chromium and desktop WebKit.

export type PreviewMode = "pdf" | "svg";

export interface PreviewCapabilities {
  /** `navigator.pdfViewerEnabled`: the browser renders PDFs itself rather than downloading them. */
  pdfViewerEnabled: boolean;
  /** `(pointer: fine)`: a mouse or trackpad, which in practice means a desktop viewer. */
  pointerFine: boolean;
  /** `?preview=pdf` or `?preview=svg` forces the mode; any other value is ignored. */
  override?: string | null;
}

// previewMode picks the preview for a set of browser capabilities. Pure, so bun test can cover the matrix headless, where `pdfViewerEnabled` is false and only the SVG path would ever run.
export function previewMode({ pdfViewerEnabled, pointerFine, override }: PreviewCapabilities): PreviewMode {
  if (override === "pdf" || override === "svg") return override;
  // An iPad driven by a trackpad reports `pointer: fine` and would land on an iframe it cannot show; `?preview=svg` is the way out until a signal that separates it turns up.
  return pdfViewerEnabled && pointerFine ? "pdf" : "svg";
}

export function detectPreviewMode(): PreviewMode {
  return previewMode({
    pdfViewerEnabled: navigator.pdfViewerEnabled === true,
    pointerFine: window.matchMedia("(pointer: fine)").matches,
    override: new URLSearchParams(window.location.search).get("preview"),
  });
}
