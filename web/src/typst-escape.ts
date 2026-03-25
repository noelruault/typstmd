/**
 * Context-aware escaping for Typst markup.
 *
 * Typst has context-sensitive syntax — different characters are significant
 * in different contexts. This module exports one function per context.
 */

/**
 * Characters that have special meaning in Typst content/markup mode.
 * Each must be backslash-escaped when appearing as literal text.
 */
const TEXT_SPECIAL = /[#@$\\*_`<>\[\]]/g;

/**
 * Escape a string for use in Typst content (plain text, content blocks).
 * Backslash-escapes all Typst-significant characters.
 */
export function escapeText(s: string): string {
  if (!s) return s;
  return s.replace(TEXT_SPECIAL, (ch) => `\\${ch}`);
}

/**
 * Escape a string for use inside a Typst string literal (e.g., URLs in
 * `#link("...")` or string arguments). Only `"` and `\` need escaping.
 */
export function escapeUrl(s: string): string {
  if (!s) return s;
  return s.replace(/["\\\n]/g, (ch) => {
    if (ch === "\n") return "\\n";
    return `\\${ch}`;
  });
}

/**
 * Sanitize a string for use as a Typst label `<label-name>`.
 * Labels allow only ASCII alphanumerics, hyphens, and underscores.
 * Other characters are replaced with hyphens; leading/trailing hyphens
 * and runs of multiple hyphens are collapsed.
 */
export function escapeLabel(s: string): string {
  if (!s) return s;
  return s
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}
