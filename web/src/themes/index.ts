/**
 * Theme registry.
 *
 * Each theme is a complete Typst template string containing a `conf()`
 * function and a `horizontalrule` definition. The pipeline plugs the
 * theme into the assembled Typst source as-is.
 */

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

import { defaultTheme } from "./default";
import { minimalTheme } from "./minimal";
import { academicTheme } from "./academic";
import { ieeeTheme } from "./ieee";

export const themes: Theme[] = [defaultTheme, minimalTheme, academicTheme, ieeeTheme];

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? defaultTheme;
}
