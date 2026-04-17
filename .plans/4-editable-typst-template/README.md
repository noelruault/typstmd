# Plan: Editable Typst Template

## Context

User wants to edit the Typst template (styling, layout, `conf()` function) live in the browser, save custom templates per theme to localStorage, and load them back. The body (content) stays generated from markdown — clean separation: user owns presentation, markdown owns content.

## Files to modify

1. `web/src/template-storage.ts` — **new file**, localStorage helpers for custom templates
2. `web/src/pipeline.ts` — accept `templateOverride` option
3. `web/index.html` — add Template + Reset buttons, CSS
4. `web/src/main.ts` — wire template editing mode

## Step 1: `web/src/template-storage.ts` — new module

Keeps browser storage concerns out of `themes/index.ts` (which stays a pure registry).

```ts
const TEMPLATE_KEY_PREFIX = "typstmd:template:";

export function getCustomTemplate(themeId: string): string | null {
  return localStorage.getItem(TEMPLATE_KEY_PREFIX + themeId);
}

export function setCustomTemplate(themeId: string, template: string): void {
  localStorage.setItem(TEMPLATE_KEY_PREFIX + themeId, template);
}

export function clearCustomTemplate(themeId: string): void {
  localStorage.removeItem(TEMPLATE_KEY_PREFIX + themeId);
}

export function hasCustomTemplate(themeId: string): boolean {
  return localStorage.getItem(TEMPLATE_KEY_PREFIX + themeId) !== null;
}
```

`resolveTemplate` stays in `main.ts` or inline — it needs `getTheme` + `getCustomTemplate`, simple enough to inline where used.

## Step 2: `pipeline.ts` — templateOverride option

Add `templateOverride?: string` to `PipelineOptions`. Use it in assembly:

```ts
const templateSource = options?.templateOverride ?? theme.template;
const typstSource = [templateSource, confInvocation, body].join("\n\n");
```

Pipeline stays pure — no localStorage knowledge, just takes a string.

## Step 3: `index.html` — UI additions

- Add `Template` button (`toolbar-secondary`) between spacer and Source button
- Add `Reset` button (hidden by default, shown in template mode when custom template exists)
- CSS: `#editor.template-view` with warm background (`#fdf6e3`), `#template-toggle.active` styling

## Step 4: `main.ts` — template editing mode

### Single viewMode enum (replaces two booleans)

Replace `sourceViewActive: boolean` with:

```ts
type ViewMode = "editor" | "source" | "template";
let viewMode: ViewMode = "editor";
```

All existing `sourceViewActive` checks become `viewMode === "source"`. Eliminates impossible states.

### Template mode toggle

```ts
function setViewMode(mode: ViewMode) {
  // Exit current mode first
  if (viewMode === "template") exitTemplateMode();
  if (viewMode === "source") exitSourceMode();

  // Enter new mode
  if (mode === "template") enterTemplateMode();
  else if (mode === "source") enterSourceMode();
  // "editor" is the default — nothing special to enter

  viewMode = mode;
}
```

**`enterTemplateMode()`:**
- Save markdown from textarea
- Load `getCustomTemplate(themeId) ?? getTheme(themeId).template` into textarea
- `readOnly = false` (template IS editable)
- Add `template-view` CSS class
- Disable source toggle button

**`exitTemplateMode()`:**
- Restore markdown to textarea
- Remove `template-view` CSS class
- Re-enable source toggle button
- **Do NOT auto-save here** — persistence is handled separately (see below)

### Persistence: save only on successful compile

Broken templates must not persist across reloads. Rule:

- In `doCompile()`, when `viewMode === "template"` and compilation **succeeds**: call `setCustomTemplate(themeId, editor.value)`
- If compilation fails: template stays in textarea for editing but is NOT saved to localStorage
- On page reload, `resolveTemplate` falls back to last good custom template or built-in

### doCompile() changes

```ts
const templateOverride = viewMode === "template"
  ? editor.value                                              // live textarea
  : getCustomTemplate(themeSelect.value) ?? undefined;        // saved or built-in fallback

const { typstSource, warnings } = markdownToTypst(currentMarkdown, {
  themeId: themeSelect.value,
  hardBreaks: hardBreaksToggle.checked,
  templateOverride,
});

// After successful compile, persist template if in template mode
if (viewMode === "template") {
  setCustomTemplate(themeSelect.value, editor.value);
}
```

### Input handler changes

```ts
editor.addEventListener("input", () => {
  if (viewMode === "template") {
    // Debounced compile with live template (longer debounce — template edits are heavier)
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doCompile, 800);
    return;
  }
  if (viewMode === "editor") {
    scheduleSave();
    scheduleCompile();
  }
  // viewMode === "source": no-op (read-only)
});
```

### Theme switching

Track previous theme to save work when switching mid-edit:

```ts
let previousThemeId = themeSelect.value;  // initialized on load

themeSelect.addEventListener("change", () => {
  if (viewMode === "template") {
    // Save current textarea for old theme (only if it compiled successfully — tracked by flag)
    // Load template for new theme
    editor.value = getCustomTemplate(themeSelect.value) ?? getTheme(themeSelect.value).template;
  }
  previousThemeId = themeSelect.value;
  doCompile();
});
```

### Transition guards

- **Template → Source**: `setViewMode("source")` exits template first, enters source
- **Source → Template**: `setViewMode("template")` exits source first, enters template
- **Any → Editor**: `setViewMode("editor")` exits current mode
- All transitions go through `setViewMode()` — no impossible states

### Reset button

```ts
resetBtn.addEventListener("click", () => {
  clearCustomTemplate(themeSelect.value);
  editor.value = getTheme(themeSelect.value).template;
  doCompile();
  updateResetVisibility();
});
```

Show reset button only when: `viewMode === "template" && hasCustomTemplate(themeSelect.value)`.

### Drag-and-drop guard

Existing drop handler exits source view. Extend to exit template mode too:

```ts
if (viewMode !== "editor") setViewMode("editor");
```

## localStorage key scheme

- Markdown: `typstmd:autosave` (existing)
- Templates: `typstmd:template:{themeId}` (e.g. `typstmd:template:default`)

## Verification

1. Click Template → see current theme's `conf()` function, editable
2. Change a style (e.g. font size) → PDF updates live
3. Click Template again (back to Editor) → markdown restored, PDF uses custom template
4. Reload page → custom template persists, PDF still styled
5. Switch theme dropdown → loads that theme's template (custom if saved, built-in otherwise)
6. Click Reset → reverts to built-in theme, custom cleared from localStorage
7. Source view → shows full output including custom template (read-only)
8. Typst syntax error in template → error in status bar, last good PDF stays, broken template NOT persisted
9. Click Template while in Source view → exits source, enters template cleanly
10. Switch theme outside template mode → picks up saved custom template for that theme
11. Drop .md file while in template mode → exits template, loads markdown
