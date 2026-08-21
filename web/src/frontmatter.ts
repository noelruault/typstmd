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
import { escapeText, escapeUrl } from "./typst-escape";
import type { Node, Parent } from "unist";

export interface Metadata {
  title?: string;
  author?: string | string[];
  date?: string;
  lang?: string;
  toc?: boolean;
  /** Every key the document declared, including ones typstmd assigns no meaning to. */
  all?: Record<string, unknown>;
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

  if (typeof raw.toc === "boolean") {
    meta.toc = raw.toc;
  }

  meta.all = raw;

  return meta;
}

/**
 * Document properties for templates that expose no `conf` to receive them.
 * String literals, not content blocks: `document.author` rejects content outright.
 */
export function encodeDocumentSet(meta: Metadata): string {
  const args: string[] = [];
  if (meta.title) args.push(`title: "${escapeUrl(meta.title)}"`);
  if (meta.author && meta.author.length > 0) {
    const authors = (Array.isArray(meta.author) ? meta.author : [meta.author])
      .map((name) => `"${escapeUrl(name)}"`)
      .join(", ");
    args.push(`author: (${authors},)`);
  }
  return args.length > 0 ? `#set document(${args.join(", ")})` : "";
}

// Values are passed through, never acted on; interpreting styling keys here would make typstmd a style engine instead of a converter.
export function encodeFrontmatterDict(meta: Metadata): string {
  const raw = meta.all;
  if (!raw || Object.keys(raw).length === 0) return "";

  const entries = Object.entries(raw)
    .map(([key, value]) => {
      const encoded = encodeValue(value);
      return encoded === undefined ? undefined : `  ${encodeKey(key)}: ${encoded},`;
    })
    .filter((line): line is string => line !== undefined);

  if (entries.length === 0) return "";
  return `#let frontmatter = (\n${entries.join("\n")}\n)`;
}

/** Typst identifiers allow hyphens but not every YAML key shape, so quote what cannot be bare. */
function encodeKey(key: string): string {
  return /^[A-Za-z][A-Za-z0-9-]*$/.test(key) ? key : `"${escapeUrl(key)}"`;
}

function encodeValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return "none";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === "string") return `[${escapeText(value)}]`;
  if (value instanceof Date) return `[${escapeText(value.toISOString().slice(0, 10))}]`;
  if (Array.isArray(value)) {
    const items = value.map(encodeValue).filter((v): v is string => v !== undefined);
    // Trailing comma: a one-element Typst array without it is just a parenthesised value.
    return `(${items.join(", ")}${items.length === 1 ? "," : ""})`;
  }
  if (typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const encoded = encodeValue(v);
        return encoded === undefined ? undefined : `${encodeKey(k)}: ${encoded}`;
      })
      .filter((v): v is string => v !== undefined);
    return inner.length > 0 ? `(${inner.join(", ")})` : "(:)";
  }
  return undefined;
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

  if (meta.toc) {
    args.push(`  toc: true`);
  }

  if (args.length === 0) {
    return "#show: doc => conf(doc)";
  }

  return `#show: doc => conf(\n${args.join(",\n")},\n  doc,\n)`;
}
