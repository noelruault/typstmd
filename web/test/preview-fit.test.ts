import { describe, it, expect } from "bun:test";
import { fitPage } from "../src/preview-fit";

const A4 = { w: 596, h: 842 };

describe("fitPage", () => {
  it("is height-bound in the split-screen pane, where the pane is wide and short", () => {
    const fit = fitPage(A4.w, A4.h, A4.w, 384, 320)!;
    expect(fit.scale).toBeCloseTo(320 / 842, 5);
    // The page must fit both ways: that is the point over plain fit-to-height.
    expect(A4.w * fit.scale).toBeLessThanOrEqual(384);
    expect(A4.h * fit.scale).toBeLessThanOrEqual(320);
  });

  it("is width-bound when maximized, where the pane is tall", () => {
    const fit = fitPage(A4.w, A4.h, A4.w, 384, 622)!;
    expect(fit.scale).toBeCloseTo(384 / 596, 5);
    expect(A4.h * fit.scale).toBeLessThanOrEqual(622);
  });

  it("scales the css width from the viewBox, not the page, so a wide landscape svg stays proportional", () => {
    const fit = fitPage(842, 596, 842, 400, 400)!;
    expect(fit.cssWidth).toBeCloseTo(842 * (400 / 842), 5);
  });

  it("returns null for degenerate geometry instead of NaN styles", () => {
    expect(fitPage(0, A4.h, A4.w, 384, 320)).toBeNull();
    expect(fitPage(A4.w, A4.h, A4.w, 0, 320)).toBeNull();
  });
});

import { clampZoomWidth, anchoredScroll } from "../src/preview-fit";

describe("pinch zoom", () => {
  it("never zooms out past page-fit and never past the ceiling", () => {
    expect(clampZoomWidth(100, 227, 412)).toBe(227);
    expect(clampZoomWidth(9999, 227, 412)).toBe(412 * 5);
    expect(clampZoomWidth(800, 227, 412)).toBe(800);
  });

  it("keeps the content under the fingers stationary: zooming 2x about a point doubles its content offset", () => {
    const s = anchoredScroll(100, 300, 50, 60, 2);
    // The content point at (150, 360) must still sit 50/60 px into the pane afterwards.
    expect(s.left).toBe(150 * 2 - 50);
    expect(s.top).toBe(360 * 2 - 60);
  });

  it("is the identity at scale 1", () => {
    expect(anchoredScroll(120, 40, 10, 20, 1)).toEqual({ left: 120, top: 40 });
  });
});
