import { createCompiler, type TypstCompiler } from "./typst-compiler";
import { markdownToTypst } from "./pipeline";
import { getTheme } from "./themes/index";
import {
  getCustomTemplate,
  setCustomTemplate,
  clearCustomTemplate,
  hasCustomTemplate,
} from "./template-storage";

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
let currentPdfUrl: string | null = null;
let latestJobId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastTypstSource = "";
let viewMode: ViewMode = "editor";
let previousThemeId = "default";

const unsavedBadge = document.getElementById("unsaved-badge") as HTMLSpanElement;
const editor = document.getElementById("editor") as HTMLTextAreaElement;
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
const statusEl = document.getElementById("status") as HTMLDivElement;
const darkToggle = document.getElementById("dark-toggle") as HTMLButtonElement;

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
    localStorage.setItem(AUTOSAVE_KEY, editor.value);
    clearDirty();
  }, 1000);
}

function setStatus(msg: string, kind: "info" | "error" | "loading" = "info") {
  statusEl.textContent = msg;
  statusEl.className = kind === "info" ? "" : kind;
}

// Centralized UI update for template-related buttons.
// Called on every mode transition, theme change, reset, and successful save.
function updateTemplateUi() {
  // Template toggle button
  if (viewMode === "template") {
    templateToggle.classList.add("active");
    templateToggle.textContent = "Editor";
  } else {
    templateToggle.classList.remove("active");
    templateToggle.textContent = "Template";
  }

  // Source toggle button
  if (viewMode === "source") {
    viewToggle.classList.add("active");
    viewToggle.textContent = "Editor";
  } else {
    viewToggle.classList.remove("active");
    viewToggle.textContent = "Source";
  }

  // Disable source toggle in template mode, disable template toggle in source mode
  viewToggle.disabled = viewMode === "template";
  templateToggle.disabled = viewMode === "source";

  // Reset button: visible only in template mode when a custom template exists
  if (viewMode === "template" && hasCustomTemplate(themeSelect.value)) {
    resetTemplateBtn.classList.add("visible");
  } else {
    resetTemplateBtn.classList.remove("visible");
  }
}

async function doCompile() {
  const jobId = ++latestJobId;

  // Only update currentMarkdown from textarea when in editor mode
  if (viewMode === "editor") {
    currentMarkdown = editor.value;
  }

  convertBtn.disabled = true;
  setStatus("Compiling...", "loading");

  try {
    // Resolve template: live textarea in template mode, saved/built-in otherwise
    const templateOverride =
      viewMode === "template"
        ? editor.value
        : resolveTemplate(themeSelect.value);

    // Markdown → Typst source
    const { typstSource, warnings } = markdownToTypst(currentMarkdown, {
      themeId: themeSelect.value,
      hardBreaks: hardBreaksToggle.checked,
      templateOverride,
    });
    lastTypstSource = typstSource;

    // If source view is active, update the display
    if (viewMode === "source") {
      editor.value = typstSource;
    }

    // Typst source → PDF bytes
    const pdfBytes = await compiler.compile(typstSource);

    // Stale job - discard
    if (jobId !== latestJobId) return;

    // Persist template only on successful compile
    if (viewMode === "template") {
      setCustomTemplate(themeSelect.value, editor.value);
      updateTemplateUi(); // refresh reset button visibility
    }

    // Revoke old blob URL to prevent memory leak
    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl);
    }

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    currentPdfUrl = URL.createObjectURL(blob);

    preview.src = currentPdfUrl;
    downloadLink.href = currentPdfUrl;
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

    // Keep last successful PDF visible (never blank the preview)
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

// Debounced auto-compile on input (500ms idle)
function scheduleCompile() {
  if (viewMode !== "editor") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doCompile, 500);
}

// --- View mode transitions ---

function exitSourceMode() {
  editor.value = currentMarkdown;
  editor.readOnly = false;
  editor.classList.remove("source-view");
}

function enterSourceMode() {
  currentMarkdown = editor.value;
  editor.value = lastTypstSource;
  editor.readOnly = true;
  editor.classList.add("source-view");
}

function exitTemplateMode() {
  editor.value = currentMarkdown;
  editor.readOnly = false;
  editor.classList.remove("template-view");
}

function enterTemplateMode() {
  if (viewMode === "editor") {
    currentMarkdown = editor.value;
  }
  editor.value = resolveTemplate(themeSelect.value);
  editor.readOnly = false;
  editor.classList.add("template-view");
}

function setViewMode(mode: ViewMode) {
  if (mode === viewMode) {
    // Toggle back to editor
    mode = "editor";
  }

  // Exit current mode
  if (viewMode === "source") exitSourceMode();
  if (viewMode === "template") exitTemplateMode();

  // Enter new mode
  if (mode === "source") enterSourceMode();
  if (mode === "template") enterTemplateMode();

  viewMode = mode;
  updateTemplateUi();
}

// --- Event listeners ---

convertBtn.addEventListener("click", doCompile);

editor.addEventListener("input", () => {
  if (viewMode === "template") {
    // Debounced compile with live template (longer debounce for template edits)
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doCompile, 800);
    return;
  }
  if (viewMode === "editor") {
    scheduleSave();
    scheduleCompile();
  }
  // source mode: read-only, no-op
});

viewToggle.addEventListener("click", () => setViewMode("source"));
templateToggle.addEventListener("click", () => setViewMode("template"));

resetTemplateBtn.addEventListener("click", () => {
  clearCustomTemplate(themeSelect.value);
  editor.value = getTheme(themeSelect.value).template;
  updateTemplateUi();
  doCompile();
});

themeSelect.addEventListener("change", () => {
  if (viewMode === "template") {
    // Switching themes while editing: load template for new theme
    // (old theme's template was already persisted on last successful compile)
    editor.value = resolveTemplate(themeSelect.value);
  }
  previousThemeId = themeSelect.value;
  updateTemplateUi();
  doCompile();
});

hardBreaksToggle.addEventListener("change", doCompile);

// Dark mode toggle: persisted in localStorage
const DARK_KEY = "typstmd:dark";

function applyDarkMode(dark: boolean) {
  document.body.classList.toggle("dark", dark);
  darkToggle.textContent = dark ? "☀️" : "🌙";
  localStorage.setItem(DARK_KEY, dark ? "1" : "0");
}

darkToggle.addEventListener("click", () => {
  applyDarkMode(!document.body.classList.contains("dark"));
});

// Initialize dark mode from saved preference or OS preference
const savedDark = localStorage.getItem(DARK_KEY);
if (savedDark !== null) {
  applyDarkMode(savedDark === "1");
} else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  applyDarkMode(true);
}

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
    editor.value = text;
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
  previousThemeId = themeSelect.value;
  editor.value = currentMarkdown; // restored from localStorage or DEFAULT_MARKDOWN
  updateTemplateUi();
  try {
    compiler = createCompiler();
    await compiler.init();
    convertBtn.disabled = false;
    // Auto-compile on init so source view and PDF are immediately available
    doCompile();
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    setStatus(`Failed to initialize compiler: ${msg}`, "error");
  }
}

init();
