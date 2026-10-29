import { describe, expect, test } from "bun:test";
import { previewMode } from "../src/preview-mode";

describe("previewMode", () => {
  test("desktop gets the browser's own PDF viewer", () => {
    expect(previewMode({ pdfViewerEnabled: true, pointerFine: true })).toBe("pdf");
  });

  // Measured under playwright: WebKit answers `pdfViewerEnabled: true` on the iPhone and iPad profiles, and Chromium's iPad emulation does the same, so the flag alone would send a phone to the iframe it cannot render.
  test("a touch device stays on the SVG even when it claims a PDF viewer", () => {
    expect(previewMode({ pdfViewerEnabled: true, pointerFine: false })).toBe("svg");
  });

  test("a browser that downloads PDFs instead of showing them stays on the SVG", () => {
    expect(previewMode({ pdfViewerEnabled: false, pointerFine: true })).toBe("svg");
  });

  test("the query override wins both ways", () => {
    expect(previewMode({ pdfViewerEnabled: false, pointerFine: false, override: "pdf" })).toBe("pdf");
    expect(previewMode({ pdfViewerEnabled: true, pointerFine: true, override: "svg" })).toBe("svg");
  });

  test("an unknown override is ignored rather than obeyed", () => {
    expect(previewMode({ pdfViewerEnabled: true, pointerFine: true, override: "yes" })).toBe("pdf");
    expect(previewMode({ pdfViewerEnabled: true, pointerFine: true, override: null })).toBe("pdf");
  });
});
