// Page-fit zoom for the mobile preview: scale the SVG so one whole page is visible in the pane, the way a PDF viewer's "fit page" works. Fit-to-height alone overflows sideways on a portrait phone (an A4 page is taller than the split pane is wide), so the scale is the smaller of the two fits and the page letterboxes instead of scrolling.
//
// Kept free of DOM imports so the math is testable under bun, which has no document.

export interface PageFit {
  /** CSS pixel width to set on the <svg>; height follows from the aspect ratio. */
  cssWidth: number;
  scale: number;
}

export function fitPage(
  pageWidth: number,
  pageHeight: number,
  svgViewBoxWidth: number,
  paneWidth: number,
  paneHeight: number,
): PageFit | null {
  if (pageWidth <= 0 || pageHeight <= 0 || svgViewBoxWidth <= 0 || paneWidth <= 0 || paneHeight <= 0) {
    return null;
  }
  const scale = Math.min(paneWidth / pageWidth, paneHeight / pageHeight);
  return { cssWidth: svgViewBoxWidth * scale, scale };
}

/** Clamp a pinch-zoomed width between page-fit (nothing smaller is useful) and a hard ceiling. */
export function clampZoomWidth(width: number, fitWidth: number, paneWidth: number): number {
  return Math.min(Math.max(width, fitWidth), paneWidth * 5);
}

/**
 * Scroll offsets that keep the content under the gesture's anchor point stationary while the
 * SVG's width changes by `scale`. cx/cy are the anchor in pane coordinates.
 */
export function anchoredScroll(
  scrollLeft: number,
  scrollTop: number,
  cx: number,
  cy: number,
  scale: number,
): { left: number; top: number } {
  return {
    left: (scrollLeft + cx) * scale - cx,
    top: (scrollTop + cy) * scale - cy,
  };
}

/** Separation between pages, in SVG user units (≈ pt at 1:1). */
export const PAGE_GAP = 18;

/**
 * Where each page sits, and how tall the document is, once `gap` separates the pages.
 * The renderer stacks them edge to edge, which reads as one endless page.
 */
export function pageOffsets(heights: number[], gap: number): { offsets: number[]; totalHeight: number } {
  let y = 0;
  const offsets = heights.map((height) => {
    const top = y;
    y += height + gap;
    return top;
  });
  return { offsets, totalHeight: Math.max(0, y - gap) };
}
