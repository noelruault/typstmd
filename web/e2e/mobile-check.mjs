// Mobile preview invariants, checked in a real browser at Pixel 7 size.
//
// bun test cannot see a rendered layout, so the invariants that broke on real phones live here:
// the pane split, the fit-width default, the maximize toggle, and the double-tap page-fit.
// Manual, not CI: it needs playwright and a Chromium (`npx playwright install chromium`), and the dev server running (`bun run dev`). Run with: node e2e/mobile-check.mjs
//
// Every check prints PASS/FAIL and the script exits non-zero on any FAIL.

import { chromium, devices } from "playwright";

const BASE = process.env.TYPSTMD_URL ?? "http://localhost:3000/";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

// TYPSTMD_CHROMIUM overrides the browser binary for environments with a system Chromium instead of a playwright-managed one.
const browser = await chromium.launch(
  process.env.TYPSTMD_CHROMIUM ? { executablePath: process.env.TYPSTMD_CHROMIUM } : {},
);
const page = await (await browser.newContext({ ...devices["Pixel 7"] })).newPage();
await page.addInitScript(() => {
  const doc = ["# Page one", "Text.", "+++", "# Page two", "More."].join("\n\n");
  localStorage.setItem("typstmd:autosave", doc);
});
await page.goto(BASE, { waitUntil: "load" });
await page.waitForFunction(
  () => /Compiled/.test(document.getElementById("status")?.textContent ?? ""),
  null,
  { timeout: 180_000 },
);

// The 2026-08 phone bug: the editor grew with the document and pushed the preview off-screen.
const layout = await page.evaluate(() => {
  const rect = (id) => document.getElementById(id).getBoundingClientRect();
  const preview = rect("preview-container");
  return {
    previewOnScreen: preview.top >= 0 && preview.bottom <= innerHeight + 1,
    statusOnScreen: rect("statusbar").bottom <= innerHeight + 1,
    pageScrolls: document.documentElement.scrollHeight > innerHeight,
  };
});
check("preview pane fully on screen", layout.previewOnScreen);
check("status bar on screen", layout.statusOnScreen);
check("page itself does not scroll", !layout.pageScrolls);

// Pages have to read as pages: the renderer stacks them edge to edge, which scrolls as one sheet.
const paging = await page.evaluate(() => {
  const pages = [...document.querySelectorAll("#preview svg .typst-page")];
  const box = (el) => el.getBoundingClientRect();
  return {
    count: pages.length,
    gap: pages.length > 1 ? box(pages[1]).top - box(pages[0]).bottom : 0,
    papered: pages.every((p) => p.firstElementChild?.classList.contains("typst-page-bg")),
  };
});
check("pages are separated by a gap", paging.count > 1 && paging.gap > 1, `${paging.count} pages, gap ${paging.gap.toFixed(1)}px`);
check("every page carries its own paper", paging.papered);

const svgWidth = () =>
  page.evaluate(() => Math.round(document.querySelector("#preview svg").getBoundingClientRect().width));
const paneWidth = await page.evaluate(() => document.getElementById("preview").clientWidth);
check("default zoom is fit-width", Math.abs((await svgWidth()) - (paneWidth - 28)) <= 2, `svg ${await svgWidth()} in pane ${paneWidth}`);

// Maximize hands the editor's half to the document and restores it.
await page.click("#preview-max");
await page.waitForTimeout(300);
check("maximize hides the editor", await page.evaluate(() => document.getElementById("editor-pane").offsetParent === null));
await page.click("#preview-max");
await page.waitForTimeout(300);
check("restore brings the editor back", await page.evaluate(() => document.getElementById("editor-pane").offsetParent !== null));

// Double-tap toggles to page-fit (whole page contained) and back.
const tap = () => page.evaluate(() => {
  const p = document.getElementById("preview");
  const r = p.getBoundingClientRect();
  const t = new Touch({ identifier: 1, target: p, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
  p.dispatchEvent(new TouchEvent("touchstart", { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  p.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
});
const before = await svgWidth();
await tap(); await page.waitForTimeout(80); await tap(); await page.waitForTimeout(200);
const fitted = await svgWidth();
check("double-tap fits the whole page", fitted < before, `${before} -> ${fitted}`);
await tap(); await page.waitForTimeout(80); await tap(); await page.waitForTimeout(200);
check("double-tap returns to fit-width", Math.abs((await svgWidth()) - before) <= 2);

await browser.close();
process.exit(failures === 0 ? 0 : 1);
