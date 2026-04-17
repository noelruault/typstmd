/**
 * Frontmatter extraction and Typst value encoding.
 *
 * Parses YAML frontmatter from the MDAST tree, normalizes it into a
 * typed TypeScript object, and serializes it as a safe Typst
 * `#show: doc => conf(...)` invocation.
 *
 * No raw YAML strings are interpolated into Typst: everything goes
 * through a strict value encoder.
 */

import { parse as parseYaml } from "yaml";
import { escapeText } from "./typst-escape";
import type { Node, Parent } from "unist";

export interface Metadata {
  title?: string;
  author?: string | string[];
  date?: string;
  lang?: string;
}

/**
 * Extract YAML frontmatter from the MDAST tree.
 * remark-frontmatter adds a node with type "yaml" containing the raw YAML.
 */
export function extractFrontmatter(tree: Node): Metadata {
  if (!("children" in tree)) return {};

  const root = tree as Parent;
  for (const child of root.children) {
    if (child.type === "yaml" && "value" in child) {
      try {
        const raw = parseYaml(child.value as string);
        if (raw && typeof raw === "object") {
          return normalizeMetadata(raw as Record<string, unknown>);
        }
      } catch {
        // Invalid YAML - treat as no metadata
      }
    }
  }
  return {};
}

function normalizeMetadata(raw: Record<string, unknown>): Metadata {
  const meta: Metadata = {};

  if (typeof raw.title === "string" && raw.title.trim()) {
    meta.title = raw.title.trim();
  }

  if (raw.author !== undefined) {
    if (typeof raw.author === "string") {
      meta.author = [raw.author.trim()];
    } else if (Array.isArray(raw.author)) {
      meta.author = raw.author
        .filter((a) => typeof a === "string")
        .map((a) => (a as string).trim());
    }
  }

  if (typeof raw.date === "string" && raw.date.trim()) {
    meta.date = raw.date.trim();
  }

  if (typeof raw.lang === "string" && raw.lang.trim()) {
    meta.lang = raw.lang.trim();
  }

  return meta;
}

/**
 * Encode metadata as a Typst `#show: doc => conf(...)` invocation.
 * Uses content blocks `[...]` for string values to safely handle
 * special characters.
 */
export function encodeConfInvocation(meta: Metadata): string {
  const args: string[] = [];

  if (meta.title) {
    args.push(`  title: [${escapeText(meta.title)}]`);
  }

  if (meta.author && meta.author.length > 0) {
    const authors = (Array.isArray(meta.author) ? meta.author : [meta.author])
      .map((name) => `(name: [${escapeText(name)}])`)
      .join(", ");
    args.push(`  authors: (${authors},)`);
  }

  if (meta.date) {
    args.push(`  date: [${escapeText(meta.date)}]`);
  }

  if (meta.lang) {
    args.push(`  lang: "${meta.lang}"`);
  }

  if (args.length === 0) {
    return "#show: doc => conf(doc)";
  }

  return `#show: doc => conf(\n${args.join(",\n")},\n  doc,\n)`;
}
