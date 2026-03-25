import { createCompiler, type TypstCompiler } from "./typst-compiler";
import { markdownToTypst } from "./pipeline";

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

_Phase 2 — markdown pipeline works._
`;

let compiler: TypstCompiler;
let currentPdfUrl: string | null = null;
let latestJobId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastTypstSource = "";
let sourceViewActive = false;

const editor = document.getElementById("editor") as HTMLTextAreaElement;
const convertBtn = document.getElementById("convert-btn") as HTMLButtonElement;
const viewToggle = document.getElementById(
  "view-toggle",
) as HTMLButtonElement;
const themeSelect = document.getElementById(
  "theme-select",
) as HTMLSelectElement;
const downloadLink = document.getElementById(
  "download-link",
) as HTMLAnchorElement;
const preview = document.getElementById("preview") as HTMLIFrameElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

// Store markdown separately so we can restore it when leaving source view
let currentMarkdown = DEFAULT_MARKDOWN.trim();

function setStatus(msg: string, kind: "info" | "error" | "loading" = "info") {
  statusEl.textContent = msg;
  statusEl.className = kind === "info" ? "" : kind;
}

async function doCompile() {
  const jobId = ++latestJobId;

  // In editor mode, read from textarea; in source view, use stored markdown
  if (!sourceViewActive) {
    currentMarkdown = editor.value;
  }

  convertBtn.disabled = true;
  setStatus("Compiling...", "loading");

  try {
    // Markdown → Typst source
    const { typstSource, warnings } = markdownToTypst(currentMarkdown, {
      themeId: themeSelect.value,
    });
    lastTypstSource = typstSource;

    // If source view is active, update the display
    if (sourceViewActive) {
      editor.value = typstSource;
    }

    // Typst source → PDF bytes
    const pdfBytes = await compiler.compile(typstSource);

    // Stale job — discard
    if (jobId !== latestJobId) return;

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
    // Stale job — discard
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
  if (sourceViewActive) return; // Don't auto-compile in source view
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doCompile, 500);
}

// Source/Editor toggle
function toggleSourceView() {
  sourceViewActive = !sourceViewActive;

  if (sourceViewActive) {
    // Switch to source view: show generated Typst
    currentMarkdown = editor.value;
    editor.value = lastTypstSource;
    editor.readOnly = true;
    editor.classList.add("source-view");
    viewToggle.classList.add("active");
    viewToggle.textContent = "Editor";
  } else {
    // Switch back to editor: restore markdown
    editor.value = currentMarkdown;
    editor.readOnly = false;
    editor.classList.remove("source-view");
    viewToggle.classList.remove("active");
    viewToggle.textContent = "Source";
  }
}

convertBtn.addEventListener("click", doCompile);
editor.addEventListener("input", scheduleCompile);
viewToggle.addEventListener("click", toggleSourceView);
themeSelect.addEventListener("change", doCompile);

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
    if (sourceViewActive) toggleSourceView(); // switch back to editor
    currentMarkdown = text;
    editor.value = text;
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
  editor.value = currentMarkdown;
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
