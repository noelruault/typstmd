// One picker holds three kinds of template, so a selection carries its kind: a bare id cannot distinguish a theme called "ieee" from a Universe package called "ieee".

export type SelectionKind = "theme" | "starter" | "user";

export interface Selection {
  kind: SelectionKind;
  id: string;
}

const KINDS: SelectionKind[] = ["theme", "starter", "user"];

export function formatSelection(selection: Selection): string {
  return `${selection.kind}:${selection.id}`;
}

/** A user template is named after a file, so its id may itself contain colons. */
export function parseSelection(value: string): Selection | null {
  const separator = value.indexOf(":");
  if (separator === -1) return null;

  const kind = value.slice(0, separator) as SelectionKind;
  const id = value.slice(separator + 1);
  if (!KINDS.includes(kind) || id === "") return null;
  return { kind, id };
}

export interface SelectionSources {
  themeTemplate(id: string): string | undefined;
  starterPreamble(id: string): string | undefined;
  userTemplate(name: string): string | null;
  /** The edited version of this selection, if the user changed it in the Template view. */
  override(key: string): string | null;
}

/**
 * resolveTemplateSource prefers an edit over the pristine source, so a customised theme
 * or starter keeps its edits across a switch away and back.
 */
export function resolveTemplateSource(value: string, sources: SelectionSources): string | null {
  const selection = parseSelection(value);
  if (!selection) return null;

  const edited = sources.override(value);
  if (edited !== null) return edited;

  return pristineSource(selection, sources);
}

export function pristineSource(selection: Selection, sources: SelectionSources): string | null {
  switch (selection.kind) {
    case "theme":
      return sources.themeTemplate(selection.id) ?? null;
    case "starter":
      return sources.starterPreamble(selection.id) ?? null;
    case "user":
      return sources.userTemplate(selection.id);
  }
}

/**
 * Which theme's font descriptor applies. Only a theme declares fonts; a Universe package or
 * a brought-in file gets the default set, which is every face the browser build loads.
 */
export function fontThemeId(value: string): string {
  const selection = parseSelection(value);
  return selection?.kind === "theme" ? selection.id : "default";
}
