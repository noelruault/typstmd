/**
 * Theme registry.
 *
 * Each theme is a complete Typst template string containing a `conf()`
 * function and a `horizontalrule` definition. The pipeline plugs the
 * theme into the assembled Typst source as-is.
 */

export interface Theme {
  id: string;
  name: string;
  template: string;
}

import { defaultTheme } from "./default";
import { minimalTheme } from "./minimal";
import { academicTheme } from "./academic";

export const themes: Theme[] = [defaultTheme, minimalTheme, academicTheme];

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? defaultTheme;
}
