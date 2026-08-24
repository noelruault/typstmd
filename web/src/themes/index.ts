// Themes are auto-discovered from this folder (plugins/content-themes.ts), so a dropped file — including a private, gitignored one — registers with no edit here.

/**
 * Fonts a theme's template names. Typst warns for every family it cannot resolve,
 * used or not, so a theme must not name a family outside this set.
 */
export interface ThemeFonts {
  families: string[];
  assets: ("text" | "cjk" | "emoji")[];
  urls?: string[];
}

export interface Theme {
  id: string;
  name: string;
  template: string;
  fonts: ThemeFonts;
}

// Loaded per document, not per theme: 10.7 MB, and a changed font set forces a new compiler.
// Pinned tag rather than a branch, so an upstream change cannot alter renders silently.
export const EMOJI_FONT = {
  family: "Noto Color Emoji",
  url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/fonts/NotoColorEmoji.ttf",
} as const;

import { allThemes } from "./registry.gen";

// `default` first (it is the fallback and the initial selection); the rest alphabetical by name.
export const themes: Theme[] = ([...allThemes] as Theme[]).sort((a, b) =>
  a.id === "default" ? -1 : b.id === "default" ? 1 : a.name.localeCompare(b.name),
);

export function getTheme(id: string): Theme {
  return (
    themes.find((t) => t.id === id) ??
    themes.find((t) => t.id === "default") ??
    themes[0]
  );
}
