// Manual, not CI: headless Chromium reports no PDF viewer, so the iframe path only exists in a headed browser.
// Needs playwright + Chromium and the dev server. Run with: node e2e/preview-modes.mjs

import { chromium, devices } from "playwright";

const BASE = process.env.TYPSTMD_URL ?? "http://localhost:3000/";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const DOC = "# Hello world\n\nThe quick brown fox jumps over the lazy dog.\n";

async function inspect({ headless = true, context = {}, query = "" } = {}) {
  // TYPSTMD_CHROMIUM overrides the browser binary for environments with a system Chromium instead of a playwright-managed one.
  const browser = await chromium.launch({
    headless,
    ...(process.env.TYPSTMD_CHROMIUM ? { executablePath: process.env.TYPSTMD_CHROMIUM } : {}),
  });
  try {
    const page = await (await browser.newContext(context)).newPage();
    await page.addInitScript((doc) => localStorage.setItem("typstmd:autosave", doc), DOC);
    await page.goto(BASE + query, { waitUntil: "load" });
    await page.waitForFunction(
      () => /Compiled/.test(document.getElementById("status")?.textContent ?? ""),
      null,
      { timeout: 90_000 },
    );
    return await page.evaluate(() => {
      const pane = document.getElementById("preview");
      const frame = pane.querySelector("iframe");
      return {
        mode: document.body.classList.contains("preview-pdf") ? "pdf" : "svg",
        iframes: pane.querySelectorAll("iframe").length,
        svgs: pane.querySelectorAll("svg").length,
        // A viewer that failed to load leaves the iframe at zero height, which a class check would miss.
        frameHeight: frame ? Math.round(frame.getBoundingClientRect().height) : 0,
        src: frame?.src ?? "",
        hasPrint: !!document.getElementById("print-pdf"),
      };
    });
  } finally {
    await browser.close();
  }
}

const headless = await inspect();
check("headless desktop falls back to the SVG", headless.mode === "svg" && headless.svgs === 1, `mode=${headless.mode}`);
check("the Print button exists", headless.hasPrint);

const desktop = await inspect({ headless: false });
check("headed desktop embeds the PDF", desktop.mode === "pdf" && desktop.iframes === 1 && desktop.svgs === 0, `mode=${desktop.mode}`);
check("the embedded viewer has height", desktop.frameHeight > 200, `${desktop.frameHeight}px`);
check("the iframe points at the compiled blob", desktop.src.startsWith("blob:"), desktop.src.slice(0, 24));
check("the viewer opens page-width with no thumbnail rail", desktop.src.includes("#navpanes=0&zoom=page-width"));

const forcedSvg = await inspect({ headless: false, query: "?preview=svg" });
check("?preview=svg overrides a desktop browser", forcedSvg.mode === "svg" && forcedSvg.svgs === 1, `mode=${forcedSvg.mode}`);

// The case the whole split exists for: a phone must never be handed an embedded PDF.
const phone = await inspect({ headless: false, context: devices["Pixel 7"] });
check("a phone stays on the SVG", phone.mode === "svg" && phone.iframes === 0, `mode=${phone.mode}`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
