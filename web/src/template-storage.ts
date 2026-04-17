/**
 * localStorage helpers for custom Typst templates.
 *
 * Each theme can have a user-customized template saved independently.
 * Keys follow the pattern: typstmd:template:{themeId}
 */

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
