import { createCompiler, type TypstCompiler } from "./typst-compiler";
import { markdownToTypst } from "./pipeline";
import { getTheme } from "./themes/index";
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
  highlightThemes,
} from "./highlight";
import type { EditorView } from "@codemirror/view";

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

type ViewMode = "editor" | "source" | "template";

let compiler: TypstCompiler;
let view: EditorView;
let currentPdfUrl: string | null = null;
let latestJobId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastTypstSource = "";
let viewMode: ViewMode = "editor";
let previousThemeId = "default";

const unsavedBadge = document.getElementById("unsaved-badge") as HTMLSpanElement;
const editorHost = document.getElementById("editor-host") as HTMLDivElement;
const convertBtn = document.getElementById("convert-btn") as HTMLButtonElement;
const viewToggle = document.getElementById(
  "view-toggle",
) as HTMLButtonElement;
const templateToggle = document.getElementById(
  "template-toggle",
) as HTMLButtonElement;
const resetTemplateBtn = document.getElementById(
  "reset-template",
) as HTMLButtonElement;
const themeSelect = document.getElementById(
  "theme-select",
) as HTMLSelectElement;
const downloadLink = document.getElementById(
  "download-link",
) as HTMLAnchorElement;
const preview = document.getElementById("preview") as HTMLIFrameElement;
const hardBreaksToggle = document.getElementById(
  "hard-breaks-toggle",
) as HTMLInputElement;
const wrapLinesToggle = document.getElementById(
  "wrap-lines-toggle",
) as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const darkToggle = document.getElementById("dark-toggle") as HTMLButtonElement;
const highlightSelect = document.getElementById(
  "highlight-select",
) as HTMLSelectElement;

// Store markdown separately so we can restore it when leaving source/template view.
// Prefer the auto-saved content from a previous session over the default.
const savedMarkdown = localStorage.getItem(AUTOSAVE_KEY);
let currentMarkdown = savedMarkdown ?? DEFAULT_MARKDOWN.trim();

function resolveTemplate(themeId: string): string {
  return getCustomTemplate(themeId) ?? getTheme(themeId).template;
}

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
    localStorage.setItem(AUTOSAVE_KEY, getValue(view));
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

// Centralized UI update for template-related buttons.
function updateTemplateUi() {
  if (viewMode === "template") {
    templateToggle.classList.add("active");
    templateToggle.textContent = "Editor";
  } else {
    templateToggle.classList.remove("active");
    templateToggle.textContent = "Template";
  }

  if (viewMode === "source") {
    viewToggle.classList.add("active");
    viewToggle.textContent = "Editor";
  } else {
    viewToggle.classList.remove("active");
    viewToggle.textContent = "Source";
  }

  viewToggle.disabled = viewMode === "template";
  templateToggle.disabled = viewMode === "source";

  if (viewMode === "template" && hasCustomTemplate(themeSelect.value)) {
    resetTemplateBtn.classList.add("visible");
  } else {
    resetTemplateBtn.classList.remove("visible");
  }
}

async function doCompile() {
  const jobId = ++latestJobId;

  // Only update currentMarkdown when in editor mode
  if (viewMode === "editor") {
    currentMarkdown = getValue(view);
  }

  convertBtn.disabled = true;
  setStatus("Compiling...", "loading");

  try {
    const templateOverride =
      viewMode === "template"
        ? getValue(view)
        : resolveTemplate(themeSelect.value);

    const { typstSource, warnings } = markdownToTypst(currentMarkdown, {
      themeId: themeSelect.value,
      hardBreaks: hardBreaksToggle.checked,
      templateOverride,
    });
    lastTypstSource = typstSource;

    if (viewMode === "source") {
      setValue(view, typstSource);
    }

    const pdfBytes = await compiler.compile(typstSource);

    // Stale job - discard
    if (jobId !== latestJobId) return;

    // Persist template only on successful compile
    if (viewMode === "template") {
      setCustomTemplate(themeSelect.value, getValue(view));
      updateTemplateUi();
    }

    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl);
    }

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    currentPdfUrl = URL.createObjectURL(blob);

    preview.src = currentPdfUrl;
    downloadLink.href = currentPdfUrl;
    downloadLink.download = `${pdfFilenameStem()}.pdf`;
    downloadLink.style.display = "inline";

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

    const errors = compiler.getErrors();
    const msg = errors.length
      ? errors.join("; ")
      : err instanceof Error
        ? err.message
        : JSON.stringify(err);
    setStatus(`Compile error: ${msg}`, "error");
  } finally {
    if (jobId === latestJobId) {
      convertBtn.disabled = false;
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
  currentMarkdown = getValue(view);
  setValue(view, lastTypstSource);
  setReadOnly(view, true);
}

function exitTemplateMode() {
  setValue(view, currentMarkdown);
  setReadOnly(view, false);
}

function enterTemplateMode() {
  if (viewMode === "editor") {
    currentMarkdown = getValue(view);
  }
  setValue(view, resolveTemplate(themeSelect.value));
  setReadOnly(view, false);
}

function setViewMode(mode: ViewMode) {
  if (mode === viewMode) {
    mode = "editor";
  }

  if (viewMode === "source") exitSourceMode();
  if (viewMode === "template") exitTemplateMode();

  if (mode === "source") enterSourceMode();
  if (mode === "template") enterTemplateMode();

  viewMode = mode;
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

convertBtn.addEventListener("click", doCompile);
viewToggle.addEventListener("click", () => setViewMode("source"));
templateToggle.addEventListener("click", () => setViewMode("template"));

resetTemplateBtn.addEventListener("click", () => {
  clearCustomTemplate(themeSelect.value);
  setValue(view, getTheme(themeSelect.value).template);
  updateTemplateUi();
  doCompile();
});

themeSelect.addEventListener("change", () => {
  if (viewMode === "template") {
    setValue(view, resolveTemplate(themeSelect.value));
  }
  previousThemeId = themeSelect.value;
  updateTemplateUi();
  doCompile();
});

hardBreaksToggle.addEventListener("change", doCompile);

const WRAP_LINES_KEY = "typstmd:wrap-lines";
wrapLinesToggle.checked = localStorage.getItem(WRAP_LINES_KEY) === "1";
wrapLinesToggle.addEventListener("change", () => {
  localStorage.setItem(WRAP_LINES_KEY, wrapLinesToggle.checked ? "1" : "0");
  if (view) setLineWrap(view, wrapLinesToggle.checked);
});

// Dark mode + highlight theme, persisted in localStorage. Each UI mode
// (dark / light) remembers its own highlight theme so toggling the sun/moon
// flips both the chrome and the editor to a matching palette.
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

function applyDarkMode(dark: boolean) {
  document.body.classList.toggle("dark", dark);
  darkToggle.textContent = dark ? "☀️" : "🌙";
  localStorage.setItem(DARK_KEY, dark ? "1" : "0");
  populateHighlightOptions(dark);
  const themeId = currentHighlightThemeId(dark);
  highlightSelect.value = themeId;
  if (view) setHighlightTheme(view, themeId);
}

darkToggle.addEventListener("click", () => {
  applyDarkMode(!isDark());
});

highlightSelect.addEventListener("change", () => {
  const themeId = highlightSelect.value;
  localStorage.setItem(highlightKey(isDark()), themeId);
  if (view) setHighlightTheme(view, themeId);
});

// Initialize mode first so highlight options + value reflect the right set
// before the editor view is created.
migrateLegacyHighlight();
const savedDark = localStorage.getItem(DARK_KEY);
const initialDark =
  savedDark !== null
    ? savedDark === "1"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
applyDarkMode(initialDark);

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

  if (!file.name.endsWith(".md") && !file.name.endsWith(".markdown") && file.type !== "text/markdown") {
    setStatus("Drop a .md file to load it");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result as string;
    if (viewMode !== "editor") setViewMode("editor");
    currentMarkdown = text;
    setValue(view, text);
    localStorage.setItem(AUTOSAVE_KEY, text);
    clearDirty();
    setStatus(`Loaded ${file.name}`);
    doCompile();
  };
  reader.readAsText(file);
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

  previousThemeId = themeSelect.value;
  view = createEditorView(editorHost, currentMarkdown, currentHighlightThemeId(isDark()), onDocChange);
  if (wrapLinesToggle.checked) setLineWrap(view, true);
  performance.mark("editor-ready");
  performance.measure("codemirror-mount", "init-start", "editor-ready");

  updateTemplateUi();
  try {
    compiler = createCompiler();
    await compiler.init();
    performance.mark("compiler-ready");
    performance.measure("compiler-total", "init-start", "compiler-ready");

    convertBtn.disabled = false;

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
