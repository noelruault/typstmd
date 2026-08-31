import type { FontSpec } from "./typst-compiler";
import { compileInWorker } from "./compile-client";
import { renderPreviewSvg, separatePages } from "./svg-preview";
import { fitPage, clampZoomWidth, anchoredScroll } from "./preview-fit";
import { AGENT_ONBOARDING_PROMPT } from "./agent-onboarding";
import { markdownToTypst } from "./pipeline";
import { getTheme, themes, EMOJI_FONT, FONT_URLS, LOCAL_FONT_FILES } from "./themes/index";
import { starters, getStarter } from "./starters";
import {
  formatSelection,
  fontThemeId,
  parseSelection,
  pristineSource,
  resolveTemplateSource,
  type SelectionSources,
} from "./template-selection";
import { classifyDroppedFile } from "./dropped-file";
import {
  listUserTemplates,
  getUserTemplate,
  hasUserTemplate,
  saveUserTemplate,
} from "./user-templates";
import { fetchImages, scanImageUrls, prefetchCompilerWasm } from "./resources";
import {
  getCustomTemplate,
  setCustomTemplate,
  clearCustomTemplate,
  hasCustomTemplate,
} from "./template-storage";
import {
  createEditorView,
  getValue,
  setValue,
  setReadOnly,
  setHighlightTheme,
  setLineWrap,
  setLanguage,
  highlightThemes,
} from "./highlight";
import type { EditorView } from "@codemirror/view";
import { SHOWCASE } from "./showcase";

const DEFAULT_MARKDOWN = `# Hello from typstmd

This PDF was compiled **entirely in the browser** using the Typst WASM compiler.

## Features

- Markdown parsing via \`unified\`/\`remark\`
- *Emphasis* and **strong** text
- [Links](https://github.com)
- Fenced code blocks
- GFM tables and footnotes

\`\`\`js
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

---

_Phase 2 - markdown pipeline works._
`;

const AUTOSAVE_KEY = "typstmd:autosave";
const SELECTION_KEY = "typstmd:template-selection";

type ViewMode = "editor" | "source" | "template";

let view: EditorView;
let currentPdfUrl: string | null = null;
let latestJobId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastTypstSource = "";
let viewMode: ViewMode = "editor";

const unsavedBadge = document.getElementById("unsaved-badge") as HTMLSpanElement;
const editorHost = document.getElementById("editor-host") as HTMLDivElement;
const recompileBtn = document.getElementById("recompile") as HTMLButtonElement;
const tabMarkdown = document.getElementById(
  "tab-markdown",
) as HTMLButtonElement;
const tabSource = document.getElementById("tab-source") as HTMLButtonElement;
const editTemplateBtn = document.getElementById(
  "edit-template",
) as HTMLButtonElement;
const resetTemplateBtn = document.getElementById(
  "reset-template",
) as HTMLButtonElement;
const templateSelect = document.getElementById(
  "template-select",
) as HTMLSelectElement;
const templateFileInput = document.getElementById(
  "template-file",
) as HTMLInputElement;
const showcaseBtn = document.getElementById(
  "load-showcase",
) as HTMLButtonElement;
const downloadLink = document.getElementById(
  "download-link",
) as HTMLAnchorElement;
const preview = document.getElementById("preview") as HTMLDivElement;
const previewMaxBtn = document.getElementById("preview-max") as HTMLButtonElement;
const hardBreaksToggle = document.getElementById(
  "hard-breaks-toggle",
) as HTMLInputElement;
const hardBreaksAction = document.getElementById(
  "hardbreaks-action",
) as HTMLLabelElement;
const wrapLinesToggle = document.getElementById(
  "wrap-lines-toggle",
) as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const darkToggle = document.getElementById("dark-toggle") as HTMLButtonElement;
// Two triggers share one handler: the always-visible toolbar button and the mobile entry inside the ⋯ menu.
const onboardTriggers = document.querySelectorAll<HTMLElement>(".onboard-trigger");
const highlightSelect = document.getElementById(
  "highlight-select",
) as HTMLSelectElement;

// Store markdown separately so we can restore it when leaving source/template view.
// Prefer the auto-saved content from a previous session over the default.
const savedMarkdown = localStorage.getItem(AUTOSAVE_KEY);
let currentMarkdown = savedMarkdown ?? DEFAULT_MARKDOWN.trim();

const templateSources: SelectionSources = {
  themeTemplate: (id) => themes.find((t) => t.id === id)?.template,
  starterPreamble: (id) => getStarter(id)?.preamble,
  userTemplate: (name) => getUserTemplate(name),
  override: (key) => getCustomTemplate(key),
};

function activeSelection(): string {
  return templateSelect.value || formatSelection({ kind: "theme", id: "default" });
}

/** The source that a compile uses when the Template view is not being edited. */
function resolveActiveTemplate(): string {
  return resolveTemplateSource(activeSelection(), templateSources) ?? getTheme("default").template;
}

/** Files the user dropped on the page, keyed by the path their Markdown refers to. */
const droppedFiles = new Map<string, Uint8Array>();

async function resolveAssets(markdown: string) {
  const fetched = await fetchImages(scanImageUrls(markdown));
  const paths = new Map<string, string>();
  const files: { path: string; bytes: Uint8Array }[] = [];

  for (const [url, asset] of fetched) {
    if (asset) {
      paths.set(url, asset.path);
      files.push(asset);
    }
  }
  for (const [name, bytes] of droppedFiles) {
    const path = name.startsWith("/") ? name : `/${name}`;
    paths.set(name, path);
    files.push({ path, bytes });
  }
  return { paths, files };
}

// The "emoji" asset group is unused: its NotoColorEmoji URL 404s at the pinned typst-dev-assets tag.
// A theme names its faces in the `.typ`; load the CDN URL for each non-embedded one it actually names.
const FONT_NAME = /(?:font: |[\w-]*-font\s*=\s*)"([^"]+)"/g;

function fontsFor(themeId: string, withEmoji: boolean): FontSpec {
  const theme = getTheme(themeId);
  const named = new Set([...theme.template.matchAll(FONT_NAME)].map((m) => m[1]));
  // The baseline set is self-hosted (web/fonts/, see LOCAL_FONT_FILES): the compiler embeds no fonts, and loading these from our own origin means a network that blocks CDNs cannot kill the compile. assets stays empty so typst.ts fetches nothing from jsdelivr on its own.
  const urls = LOCAL_FONT_FILES.map((f) => new URL(`./fonts/${f}`, document.baseURI).href);
  urls.push(...(theme.fonts.urls ?? []));
  for (const family of named) {
    if (FONT_URLS[family]) urls.push(...FONT_URLS[family]);
  }
  return {
    assets: [],
    urls: withEmoji ? [...urls, EMOJI_FONT.url] : urls,
  };
}

// Mobile defaults to fit-width: the page fills the pane and the text is readable, which is what a phone reader wants first. Page-fit (the whole page letterboxed in the pane) is one double-tap away, and pinch covers everything in between; both are in the touch handlers below. Desktop keeps the stylesheet's fit-width and is untouched.
const mobileLayout = window.matchMedia("(max-width: 768px)");

// A pinch or double-tap sets this; page-fit applies only while it is null, so a recompile as the user types does not snap their reading zoom back out. Rotation, resize and the maximize toggle reset it: the pane they zoomed against no longer exists.
let userZoomWidth: number | null = null;

function pageFitWidth(): number | null {
  const svg = preview.querySelector("svg");
  if (!svg) return null;
  const page = svg.querySelector(".typst-page");
  const pageW = Number(page?.getAttribute("data-page-width"));
  const pageH = Number(page?.getAttribute("data-page-height"));
  // clientWidth/Height exclude the scrollbar but include the 14px padding on each side.
  const fit = fitPage(pageW, pageH, svg.viewBox.baseVal.width, preview.clientWidth - 28, preview.clientHeight - 28);
  return fit ? fit.cssWidth : null;
}

function fitPreviewToPane() {
  const svg = preview.querySelector("svg");
  if (!svg) return;
  if (!mobileLayout.matches) {
    svg.style.width = "";
    svg.style.maxWidth = "";
    return;
  }
  // clientWidth includes the 14px padding on each side.
  const width = userZoomWidth ?? preview.clientWidth - 28;
  svg.style.width = `${width}px`;
  svg.style.maxWidth = "none";
}

// Sets an absolute zoom width, keeping the content under (cx, cy) in pane coordinates stationary.
function zoomPreviewTo(width: number, cx: number, cy: number) {
  const svg = preview.querySelector("svg");
  if (!svg) return;
  const oldWidth = svg.getBoundingClientRect().width;
  if (oldWidth <= 0) return;
  svg.style.width = `${width}px`;
  svg.style.maxWidth = "none";
  const s = anchoredScroll(preview.scrollLeft, preview.scrollTop, cx, cy, width / oldWidth);
  preview.scrollLeft = s.left;
  preview.scrollTop = s.top;
  userZoomWidth = width;
}

// Pinch to zoom, PDF-viewer style: two fingers change the SVG's width (native overflow scrolling is the pan), a double tap toggles page-fit and a readable fit-width. Touch-only by nature, so desktop is untouched. touch-action on #preview stops the browser zooming the whole app instead.
const touchDistance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
let pinchStart: { distance: number; width: number } | null = null;
let lastTap = { time: 0, x: 0, y: 0 };

preview.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length !== 2) return;
    const svg = preview.querySelector("svg");
    if (!svg) return;
    pinchStart = { distance: touchDistance(e.touches), width: svg.getBoundingClientRect().width };
  },
  { passive: true },
);

preview.addEventListener(
  "touchmove",
  (e) => {
    if (!pinchStart || e.touches.length !== 2) return;
    // Ours, not the browser's page zoom; passive:false makes this preventDefault effective.
    e.preventDefault();
    const fit = pageFitWidth();
    if (fit === null) return;
    const target = clampZoomWidth(
      pinchStart.width * (touchDistance(e.touches) / pinchStart.distance),
      fit,
      preview.clientWidth,
    );
    const rect = preview.getBoundingClientRect();
    zoomPreviewTo(
      target,
      (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
      (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
    );
  },
  { passive: false },
);

preview.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) pinchStart = null;
  if (e.changedTouches.length !== 1 || e.touches.length !== 0) return;
  const t = e.changedTouches[0];
  const now = Date.now();
  const isDoubleTap =
    now - lastTap.time < 300 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30;
  // A recognized pair consumes both taps, so a third tap starts a new pair instead of chaining with the second into an immediate second toggle.
  lastTap = isDoubleTap ? { time: 0, x: 0, y: 0 } : { time: now, x: t.clientX, y: t.clientY };
  if (!isDoubleTap) return;
  const svg = preview.querySelector("svg");
  const fit = pageFitWidth();
  if (!svg || fit === null) return;
  const rect = preview.getBoundingClientRect();
  // Fit-width is the default, so the toggle runs the other way: anything wider than page-fit
  // (the default included) taps down to the whole page, and page-fit taps back to the default.
  if (svg.getBoundingClientRect().width > fit + 1) {
    zoomPreviewTo(fit, t.clientX - rect.left, t.clientY - rect.top);
  } else {
    userZoomWidth = null;
    fitPreviewToPane();
  }
});

function setPreviewMaximized(maximized: boolean) {
  document.body.classList.toggle("preview-maxed", maximized);
  previewMaxBtn.setAttribute("aria-pressed", String(maximized));
  previewMaxBtn.textContent = maximized ? "\u2921" : "\u2922"; // ⤡ collapse, ⤢ expand
  previewMaxBtn.title = maximized ? "Restore the editor" : "Maximize the preview";
  // The pane's size changes with the layout; refit once it has settled.
  userZoomWidth = null;
  requestAnimationFrame(fitPreviewToPane);
}

previewMaxBtn.addEventListener("click", () => {
  setPreviewMaximized(!document.body.classList.contains("preview-maxed"));
});

let refitTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRefit() {
  if (refitTimer) clearTimeout(refitTimer);
  refitTimer = setTimeout(() => {
    userZoomWidth = null;
    fitPreviewToPane();
  }, 120);
}
window.addEventListener("resize", scheduleRefit);
mobileLayout.addEventListener("change", scheduleRefit);

function setDirty() {
  unsavedBadge.classList.add("visible");
}

function clearDirty() {
  unsavedBadge.classList.remove("visible");
}

function scheduleSave() {
  setDirty();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // Save the markdown, never the source/template the editor may be showing if a view switch landed inside this 1s window.
    localStorage.setItem(AUTOSAVE_KEY, viewMode === "editor" ? getValue(view) : currentMarkdown);
    clearDirty();
  }, 1000);
}

function pdfFilenameStem(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `typstmd-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function setStatus(msg: string, kind: "info" | "error" | "loading" = "info") {
  statusEl.textContent = msg;
  statusEl.className = kind === "info" ? "" : kind;
}

// execCommand fallback covers non-secure contexts, where navigator.clipboard is undefined.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// Centralized UI update for the pane tabs and template actions.
// "source" and "template" share one tab: viewing the generated document and editing its template wrapper.
function updateTemplateUi() {
  const onSourceTab = viewMode === "source" || viewMode === "template";
  tabMarkdown.classList.toggle("active", viewMode === "editor");
  tabSource.classList.toggle("active", onSourceTab);

  // Hard breaks is a Markdown-parsing option, so it belongs to the Markdown view only.
  hardBreaksAction.classList.toggle("visible", viewMode === "editor");
  editTemplateBtn.classList.toggle("visible", onSourceTab);
  editTemplateBtn.textContent =
    viewMode === "template" ? "Done editing" : "Edit template";

  resetTemplateBtn.classList.toggle(
    "visible",
    viewMode === "template" && hasCustomTemplate(activeSelection()),
  );
}

async function doCompile() {
  const jobId = ++latestJobId;

  // Only update currentMarkdown when in editor mode
  if (viewMode === "editor") {
    currentMarkdown = getValue(view);
  }

  recompileBtn.disabled = true;
  setStatus("Compiling...", "loading");

  try {
    const templateOverride =
      viewMode === "template"
        ? getValue(view)
        : resolveActiveTemplate();

    // Image paths must be known while the body is built; the cache is keyed by URL so typing does not refetch.
    const assets = await resolveAssets(currentMarkdown);

    const { typstSource, warnings, needsEmojiFont } = markdownToTypst(currentMarkdown, {
      themeId: fontThemeId(activeSelection()),
      hardBreaks: hardBreaksToggle.checked,
      templateOverride,
      assets: assets.paths,
    });
    lastTypstSource = typstSource;

    if (viewMode === "source") {
      setValue(view, typstSource);
    }

    // sync-xhr: the worker fetches packages (merman, Universe starters) itself. Blocking there is free; on the main thread it would freeze the UI.
    const { pdfBytes, vectorBytes } = await compileInWorker({
      source: typstSource,
      fonts: fontsFor(fontThemeId(activeSelection()), needsEmojiFont),
      packageStrategy: "sync-xhr",
      assets: [...assets.files],
    });

    // Stale job - discard
    if (jobId !== latestJobId) return;

    // Persist template only on successful compile
    if (viewMode === "template") {
      setCustomTemplate(activeSelection(), getValue(view));
      updateTemplateUi();
    }

    // The preview is rendered by us, not the browser's PDF viewer: an <iframe src=pdf> shows nothing on Android Chrome and a frozen first page on iOS. The PDF now only feeds the download link. Rendering the same vector bytes the compiler just produced costs ~15ms.
    const scrolled = preview.scrollTop;
    preview.innerHTML = await renderPreviewSvg(vectorBytes);
    const rendered = preview.querySelector("svg");
    if (rendered) separatePages(rendered);
    fitPreviewToPane();
    preview.scrollTop = scrolled;

    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl);
    }

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    currentPdfUrl = URL.createObjectURL(blob);

    downloadLink.href = currentPdfUrl;
    downloadLink.download = `${pdfFilenameStem()}.pdf`;
    downloadLink.setAttribute("aria-disabled", "false");

    const warningCount = warnings.length;
    const sizeKb = (pdfBytes.byteLength / 1024).toFixed(1);
    const warningMsg =
      warningCount > 0
        ? ` | ${warningCount} warning${warningCount > 1 ? "s" : ""}`
        : "";
    setStatus(`Compiled (${sizeKb} KB)${warningMsg}`);
  } catch (err) {
    // Stale job - discard
    if (jobId !== latestJobId) return;

    const msg =
      err instanceof Error
        ? err.message
        : JSON.stringify(err);
    setStatus(`Compile error: ${msg}`, "error");
  } finally {
    if (jobId === latestJobId) {
      recompileBtn.disabled = false;
    }
  }
}

function scheduleCompile() {
  if (viewMode !== "editor") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doCompile, 500);
}

// --- View mode transitions ---

function exitSourceMode() {
  setValue(view, currentMarkdown);
  setReadOnly(view, false);
}

function enterSourceMode() {
  setValue(view, lastTypstSource);
  setReadOnly(view, true);
}

function exitTemplateMode() {
  setValue(view, currentMarkdown);
  setReadOnly(view, false);
}

function enterTemplateMode() {
  setValue(view, resolveActiveTemplate());
  setReadOnly(view, false);
}

function option(value: string, label: string): HTMLOptionElement {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function group(label: string, options: HTMLOptionElement[]): HTMLOptGroupElement {
  const grp = document.createElement("optgroup");
  grp.label = label;
  grp.append(...options);
  return grp;
}

/** Themes, Universe packages and brought-in files are all just templates, so one picker. */
function populateTemplateOptions() {
  const groups = [
    group(
      "Themes",
      themes.map((theme) => option(formatSelection({ kind: "theme", id: theme.id }), theme.name)),
    ),
    group(
      "Typst Universe",
      starters.map((starter) => option(formatSelection({ kind: "starter", id: starter.id }), starter.name)),
    ),
  ];

  const mine = listUserTemplates();
  if (mine.length > 0) {
    groups.push(
      group(
        "Yours",
        mine.map((name) => option(formatSelection({ kind: "user", id: name }), name)),
      ),
    );
  }

  const previous = templateSelect.value;
  templateSelect.replaceChildren(...groups);

  const wanted = previous || localStorage.getItem(SELECTION_KEY) || "";
  const available = [...templateSelect.options].some((opt) => opt.value === wanted);
  templateSelect.value = available ? wanted : formatSelection({ kind: "theme", id: "default" });
}

/**
 * Custom templates used to be stored per theme id. Without this, a user who had edited one
 * loses that edit the first time they load the unified picker.
 */
function migrateLegacyTemplateKeys() {
  for (const theme of themes) {
    const legacy = getCustomTemplate(theme.id);
    const key = formatSelection({ kind: "theme", id: theme.id });
    if (legacy !== null && getCustomTemplate(key) === null) {
      setCustomTemplate(key, legacy);
      clearCustomTemplate(theme.id);
    }
  }
}

/** Any Typst source can be the template: a theme, a Universe preamble, or a user's own file. */
function loadTemplateSource(label: string, source: string) {
  if (viewMode !== "template") setViewMode("template");
  setValue(view, source);
  setStatus(`Loaded ${label}`, "loading");
  doCompile();
}

/** Saves a brought-in template under its filename, selects it, and shows it for editing. */
function adoptTemplateFile(name: string, source: string) {
  const save = !hasUserTemplate(name) || confirm(`Replace the saved template "${name}"?`);
  if (save) {
    saveUserTemplate(name, source);
    populateTemplateOptions();
    templateSelect.value = formatSelection({ kind: "user", id: name });
    localStorage.setItem(SELECTION_KEY, templateSelect.value);
  }
  loadTemplateSource(save ? name : `${name} (not saved)`, source);
}

// Loads the showcase document and the theme that styles it, as one action: the two are a pair.
function loadShowcase() {
  morePop.open = false;
  const showcase = SHOWCASE.markdown;
  const current = (viewMode === "editor" ? getValue(view) : currentMarkdown).trim();
  // Ask only when there is something to lose. An untouched default, or the showcase already loaded, is not worth a prompt; anything else is the user's own document and the autosave goes with it.
  const disposable = current === DEFAULT_MARKDOWN.trim() || current === showcase || current === "";
  if (!disposable && !confirm("Replace the current document with the showcase?")) return;

  if (viewMode !== "editor") setViewMode("editor");
  currentMarkdown = showcase;
  setValue(view, showcase);
  localStorage.setItem(AUTOSAVE_KEY, showcase);
  clearDirty();

  const selection = formatSelection({ kind: "theme", id: SHOWCASE.themeId });
  templateSelect.value = selection;
  localStorage.setItem(SELECTION_KEY, selection);
  updateTemplateUi();

  setStatus("Loaded the showcase");
  doCompile();
}

function setViewMode(mode: ViewMode) {
  if (mode === viewMode) return;

  const previous = viewMode;
  if (previous === "editor") {
    currentMarkdown = getValue(view);
  }

  // Switch mode before touching the editor. setValue fires onDocChange synchronously, and under the old mode that schedules a save which writes the template over the markdown.
  viewMode = mode;

  if (previous === "source") exitSourceMode();
  if (previous === "template") exitTemplateMode();

  if (mode === "source") enterSourceMode();
  if (mode === "template") enterTemplateMode();

  setLanguage(view, mode === "editor" ? "markdown" : "typst");
  updateTemplateUi();
}

// --- Input handler ---
// The EditorView calls onDocChange on every document change.
// We route it based on the current view mode.
function onDocChange() {
  if (viewMode === "template") {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doCompile, 800);
    return;
  }
  if (viewMode === "editor") {
    scheduleSave();
    scheduleCompile();
  }
}

// --- Event listeners ---

recompileBtn.addEventListener("click", doCompile);
tabMarkdown.addEventListener("click", () => setViewMode("editor"));
tabSource.addEventListener("click", () => setViewMode("source"));
editTemplateBtn.addEventListener("click", () =>
  setViewMode(viewMode === "template" ? "source" : "template"),
);

// Native <details> popovers stay open on outside clicks; close them by hand.
const popovers = [
  ...document.querySelectorAll<HTMLDetailsElement>("details.pop"),
];
document.addEventListener("click", (e) => {
  for (const pop of popovers) {
    if (pop.open && !pop.contains(e.target as Node)) pop.open = false;
  }
});
const morePop = document.getElementById("more-pop") as HTMLDetailsElement;

resetTemplateBtn.addEventListener("click", () => {
  const value = activeSelection();
  clearCustomTemplate(value);
  const selection = parseSelection(value);
  const pristine = selection ? pristineSource(selection, templateSources) : null;
  setValue(view, pristine ?? getTheme("default").template);
  updateTemplateUi();
  doCompile();
});

templateSelect.addEventListener("change", () => {
  localStorage.setItem(SELECTION_KEY, activeSelection());
  if (viewMode === "template") {
    setValue(view, resolveActiveTemplate());
  }
  updateTemplateUi();
  doCompile();
});

async function onboardAgent(event: Event): Promise<void> {
  // Capture before the await: currentTarget is nulled once the handler returns.
  const trigger = event.currentTarget as HTMLElement;
  morePop.open = false;
  const copied = await copyText(AGENT_ONBOARDING_PROMPT);
  setStatus(
    copied
      ? "Agent prompt copied. Paste it into Claude Code, Codex, Cursor, or OpenCode."
      : "Could not access the clipboard. Copy the prompt from src/agent-onboarding.ts.",
    copied ? "info" : "error",
  );
  if (copied) {
    trigger.classList.add("copied");
    setTimeout(() => trigger.classList.remove("copied"), 1400);
  }
}
onboardTriggers.forEach((el) => el.addEventListener("click", onboardAgent));

hardBreaksToggle.addEventListener("change", doCompile);

const WRAP_LINES_KEY = "typstmd:wrap-lines";
wrapLinesToggle.checked = localStorage.getItem(WRAP_LINES_KEY) === "1";
wrapLinesToggle.addEventListener("change", () => {
  localStorage.setItem(WRAP_LINES_KEY, wrapLinesToggle.checked ? "1" : "0");
  if (view) setLineWrap(view, wrapLinesToggle.checked);
});

// Dark mode + highlight theme, persisted in localStorage. Each UI mode
// (dark / light) remembers its own highlight theme so toggling the sun/moon flips both the chrome and the editor to a matching palette.
const DARK_KEY = "typstmd:dark";
const HIGHLIGHT_DARK_KEY = "typstmd:highlight-dark";
const HIGHLIGHT_LIGHT_KEY = "typstmd:highlight-light";
const LEGACY_HIGHLIGHT_KEY = "typstmd:highlight-theme";

function isDark(): boolean {
  return document.body.classList.contains("dark");
}

function highlightKey(dark: boolean): string {
  return dark ? HIGHLIGHT_DARK_KEY : HIGHLIGHT_LIGHT_KEY;
}

function themesFor(dark: boolean) {
  return highlightThemes.filter((th) => th.dark === dark);
}

function migrateLegacyHighlight() {
  const legacy = localStorage.getItem(LEGACY_HIGHLIGHT_KEY);
  if (!legacy) return;
  const theme = highlightThemes.find((th) => th.id === legacy);
  if (theme) {
    const key = highlightKey(theme.dark);
    if (!localStorage.getItem(key)) localStorage.setItem(key, legacy);
  }
  localStorage.removeItem(LEGACY_HIGHLIGHT_KEY);
}

function populateHighlightOptions(dark: boolean) {
  highlightSelect.replaceChildren(
    ...themesFor(dark).map((th) => {
      const opt = document.createElement("option");
      opt.value = th.id;
      opt.textContent = th.name;
      return opt;
    }),
  );
}

function currentHighlightThemeId(dark: boolean): string {
  const saved = localStorage.getItem(highlightKey(dark));
  const filtered = themesFor(dark);
  if (saved && filtered.some((th) => th.id === saved)) return saved;
  return filtered[0].id;
}

// Persisting only on an explicit toggle keeps the app following the OS theme until the user overrides it.
function applyDarkMode(dark: boolean, persist = false) {
  document.body.classList.toggle("dark", dark);
  darkToggle.textContent = dark ? "☀️" : "🌙";
  if (persist) localStorage.setItem(DARK_KEY, dark ? "1" : "0");
  populateHighlightOptions(dark);
  const themeId = currentHighlightThemeId(dark);
  highlightSelect.value = themeId;
  if (view) setHighlightTheme(view, themeId);
}

darkToggle.addEventListener("click", () => {
  applyDarkMode(!isDark(), true);
});

highlightSelect.addEventListener("change", () => {
  const themeId = highlightSelect.value;
  localStorage.setItem(highlightKey(isDark()), themeId);
  if (view) setHighlightTheme(view, themeId);
});

// Initialize mode first so highlight options + value reflect the right set before the editor view is created.
migrateLegacyHighlight();
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const savedDark = localStorage.getItem(DARK_KEY);
applyDarkMode(savedDark !== null ? savedDark === "1" : systemDark.matches);
systemDark.addEventListener("change", (e) => {
  if (localStorage.getItem(DARK_KEY) === null) applyDarkMode(e.matches);
});

// Drag-and-drop .md files
const dropOverlay = document.getElementById("drop-overlay") as HTMLDivElement;
let dragCounter = 0;

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) dropOverlay.classList.add("visible");
});

document.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) dropOverlay.classList.remove("visible");
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
});

document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove("visible");

  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  switch (classifyDroppedFile(file.name, file.type)) {
    case "template":
      void file.text().then((source) => adoptTemplateFile(file.name, source));
      return;

    case "asset":
      // A browser cannot read a relative path, so a local `![](photo.png)` only works once the file is dropped in and mapped into the compiler's virtual filesystem.
      void file.arrayBuffer().then((buffer) => {
        droppedFiles.set(file.name, new Uint8Array(buffer));
        setStatus(`Added ${file.name}, available to image("${file.name}")`);
        doCompile();
      });
      return;

    case "markdown":
      void file.text().then((text) => {
        if (viewMode !== "editor") setViewMode("editor");
        currentMarkdown = text;
        setValue(view, text);
        localStorage.setItem(AUTOSAVE_KEY, text);
        clearDirty();
        setStatus(`Loaded ${file.name}`);
        doCompile();
      });
      return;
  }
});

showcaseBtn.addEventListener("click", loadShowcase);

templateFileInput.addEventListener("change", () => {
  morePop.open = false;
  const file = templateFileInput.files?.[0];
  if (!file) return;
  void file.text().then((source) => adoptTemplateFile(file.name, source));
  // Cleared so picking the same file twice fires a change event both times.
  templateFileInput.value = "";
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (currentPdfUrl) {
    URL.revokeObjectURL(currentPdfUrl);
  }
});

// Initialize
async function init() {
  performance.mark("init-start");

  // Before reading the selection: the options do not exist until this runs.
  migrateLegacyTemplateKeys();
  populateTemplateOptions();

  view = createEditorView(editorHost, currentMarkdown, currentHighlightThemeId(isDark()), onDocChange);
  if (wrapLinesToggle.checked) setLineWrap(view, true);
  performance.mark("editor-ready");
  performance.measure("codemirror-mount", "init-start", "editor-ready");

  updateTemplateUi();
  try {
    recompileBtn.disabled = false;

    // Pull the ~11 MB compiler into cache with visible progress first, so the worker's fetch is a cache hit and its compile timeout never races a slow download. Non-fatal: on failure the worker fetches it itself.
    setStatus("Downloading compiler (one-time)…", "loading");
    try {
      await prefetchCompilerWasm((mb) => setStatus(`Downloading compiler… ${mb} MB`, "loading"));
    } catch {
      /* fall through to compile; the worker will fetch the WASM itself */
    }

    performance.mark("first-compile-start");
    await doCompile();
    performance.mark("first-compile-end");
    performance.measure("first-compile", "first-compile-start", "first-compile-end");
    performance.measure("total-init", "init-start", "first-compile-end");
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    setStatus(`Failed to initialize compiler: ${msg}`, "error");
  }
}

init();
