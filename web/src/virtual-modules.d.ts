declare module "virtual:themes" {
  import type { HighlightTheme } from "./highlight/theme-builder";
  export const allThemes: HighlightTheme[];
}

// A theme may inline an asset with `import x from "./x.svg" with { type: "text" }`.
declare module "*.svg" {
  const content: string;
  export default content;
}

// Each theme is a .typ file, imported as text by the generated registry.
declare module "*.typ" {
  const content: string;
  export default content;
}
