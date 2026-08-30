// Themes are auto-discovered from this folder (plugins/content-themes.ts), so a dropped file — including a private, gitignored one — registers with no edit here.

export interface ThemeFonts {
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

// Non-embedded faces a `.typ` may name, fetched by URL from a CDN (the browser resolves the family by name).
// The baseline faces, loaded on every compile: unmodified copies committed to web/fonts/ and
// served beside the app, so no third-party CDN sits in the compile path (the WASM compiler
// embeds no fonts at all; without these every document renders blank). Relative filenames;
// fontsFor resolves them against document.baseURI so they work under the /typstmd/ subpath.
// Semibold ships because the themes set weight: "semibold"; without the face Typst silently
// substitutes bold.
export const LOCAL_FONT_FILES: string[] = [
  "LibertinusSerif-Regular.otf",
  "LibertinusSerif-Bold.otf",
  "LibertinusSerif-Italic.otf",
  "LibertinusSerif-BoldItalic.otf",
  "LibertinusSerif-Semibold.otf",
  "LibertinusSerif-SemiboldItalic.otf",
  "DejaVuSansMono.ttf",
  "DejaVuSansMono-Bold.ttf",
  "DejaVuSansMono-Oblique.ttf",
  "DejaVuSansMono-BoldOblique.ttf",
];
export const LOCAL_FONT_FAMILIES = ["Libertinus Serif", "DejaVu Sans Mono"];

// fontsFor scans the template and loads only the entries a theme actually names. Typst names the semi-condensed family "Barlow", not "Barlow Semi Condensed".
// New Computer Modern stays CDN-loaded: its GUST license text could not be obtained to commit
// beside the files (see web/fonts/README.md), and only the academic theme names it.
const EXPO = "https://cdn.jsdelivr.net/npm/@expo-google-fonts";
const TYPST_ASSETS = "https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts";
export const FONT_URLS: Record<string, string[]> = {
  "New Computer Modern": [
    `${TYPST_ASSETS}/NewCM10-Regular.otf`,
    `${TYPST_ASSETS}/NewCM10-Bold.otf`,
    `${TYPST_ASSETS}/NewCM10-Italic.otf`,
    `${TYPST_ASSETS}/NewCM10-BoldItalic.otf`,
  ],
  Arimo: [
    `${EXPO}/arimo@0.2.3/Arimo_400Regular.ttf`,
    `${EXPO}/arimo@0.2.3/Arimo_700Bold.ttf`,
    `${EXPO}/arimo@0.2.3/Arimo_400Regular_Italic.ttf`,
    `${EXPO}/arimo@0.2.3/Arimo_700Bold_Italic.ttf`,
  ],
  Barlow: [
    `${EXPO}/barlow-semi-condensed@0.2.3/BarlowSemiCondensed_400Regular.ttf`,
    `${EXPO}/barlow-semi-condensed@0.2.3/BarlowSemiCondensed_700Bold.ttf`,
    `${EXPO}/barlow-semi-condensed@0.2.3/BarlowSemiCondensed_400Regular_Italic.ttf`,
    `${EXPO}/barlow-semi-condensed@0.2.3/BarlowSemiCondensed_700Bold_Italic.ttf`,
  ],
  Montserrat: [`${EXPO}/montserrat@0.2.3/Montserrat_800ExtraBold.ttf`],
};

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
