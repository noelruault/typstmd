/**
 * MDAST tree → Typst markup string.
 *
 * Recursive serializer that walks the MDAST and emits Typst markup.
 * Each node type has an explicit handler. Unsupported nodes emit
 * warnings and render contextual placeholders.
 */

import type { Node, Parent } from "unist";
import { escapeText, escapeUrl, escapeLabel } from "./typst-escape";
import type { WarningCollector } from "./warnings";

// ── MDAST node types we handle ──────────────────────────────────────

interface MdastText extends Node {
  type: "text";
  value: string;
}
interface MdastHeading extends Parent {
  type: "heading";
  depth: 1 | 2 | 3 | 4 | 5 | 6;
}
interface MdastParagraph extends Parent {
  type: "paragraph";
}
interface MdastStrong extends Parent {
  type: "strong";
}
interface MdastEmphasis extends Parent {
  type: "emphasis";
}
interface MdastInlineCode extends Node {
  type: "inlineCode";
  value: string;
}
interface MdastCode extends Node {
  type: "code";
  value: string;
  lang?: string | null;
  meta?: string | null;
}
interface MdastLink extends Parent {
  type: "link";
  url: string;
  title?: string | null;
}
interface MdastBlockquote extends Parent {
  type: "blockquote";
}
interface MdastList extends Parent {
  type: "list";
  ordered?: boolean;
  start?: number | null;
  spread?: boolean;
  children: MdastListItem[];
}
interface MdastListItem extends Parent {
  type: "listItem";
  spread?: boolean;
}
interface MdastTable extends Parent {
  type: "table";
  align?: (string | null)[];
  children: MdastTableRow[];
}
interface MdastTableRow extends Parent {
  type: "tableRow";
  children: MdastTableCell[];
}
interface MdastTableCell extends Parent {
  type: "tableCell";
}
interface MdastThematicBreak extends Node {
  type: "thematicBreak";
}
interface MdastBreak extends Node {
  type: "break";
}
interface MdastImage extends Node {
  type: "image";
  url: string;
  alt?: string | null;
  title?: string | null;
}
interface MdastHtml extends Node {
  type: "html";
  value: string;
}
interface MdastFootnoteDefinition extends Parent {
  type: "footnoteDefinition";
  identifier: string;
  label?: string;
}
interface MdastFootnoteReference extends Node {
  type: "footnoteReference";
  identifier: string;
  label?: string;
}
interface MdastDelete extends Parent {
  type: "delete";
}
interface MdastImageReference extends Node {
  type: "imageReference";
  identifier: string;
  alt?: string | null;
  referenceType?: string;
}
interface MdastDefinition extends Node {
  type: "definition";
  identifier: string;
  url: string;
  title?: string | null;
}
interface MdastSubscript extends Parent {
  type: "subscript";
}
interface MdastSuperscript extends Parent {
  type: "superscript";
}
interface MdastMark extends Parent {
  type: "mark";
}

// ── Serializer ──────────────────────────────────────────────────────

export interface SerializeOptions {
  warnings: WarningCollector;
}

export function mdastToTypst(tree: Node, options: SerializeOptions): string {
  const { warnings } = options;

  // Footnote resolution: collect definitions, track reference counts
  const footnoteDefs = new Map<string, Node[]>();
  const footnoteRefCount = new Map<string, number>();
  collectFootnotes(tree, footnoteDefs);

  // Definition resolution (for imageReference nodes)
  const definitionDefs = new Map<string, string>();
  collectDefinitions(tree, definitionDefs);

  function serializeChildren(node: Parent, sep = ""): string {
    return node.children.map((child) => serialize(child)).join(sep);
  }

  function emitImage(url: string, alt: string): string {
    const isRemote = /^https?:\/\//i.test(url);
    if (isRemote) {
      // Remote URLs: Typst CLI can't fetch them. Emit placeholder.
      const desc = alt || url;
      return escapeText(`[Image: ${desc}]`);
    }
    return alt
      ? `#figure(image("${escapeUrl(url)}"), caption: [${escapeText(alt)}])`
      : `#figure(image("${escapeUrl(url)}"))`;
  }

  function serialize(node: Node): string {
    switch (node.type) {
      case "root":
        return serializeChildren(node as Parent, "\n\n");

      case "text":
        return escapeText((node as MdastText).value);

      case "heading": {
        const h = node as MdastHeading;
        // Normalize levels 4-6 to 3
        const depth = Math.min(h.depth, 3);
        const prefix = "=".repeat(depth);
        return `${prefix} ${serializeChildren(h)}`;
      }

      case "paragraph":
        return serializeChildren(node as MdastParagraph);

      case "strong":
        return `*${serializeChildren(node as MdastStrong)}*`;

      case "emphasis":
        return `_${serializeChildren(node as MdastEmphasis)}_`;

      case "inlineCode": {
        const c = node as MdastInlineCode;
        // Use raw backtick passthrough — no escaping inside code
        return `\`${c.value}\``;
      }

      case "code": {
        const c = node as MdastCode;
        const lang = c.lang ? c.lang : "";
        return "```" + lang + "\n" + c.value + "\n" + "```";
      }

      case "link": {
        const l = node as MdastLink;
        const text = serializeChildren(l);
        return `#link("${escapeUrl(l.url)}")[${text}]`;
      }

      case "blockquote": {
        const bq = node as MdastBlockquote;
        const inner = serializeChildren(bq, "\n\n");
        return `#quote(block: true)[${inner}]`;
      }

      case "list":
        return serializeList(node as MdastList, 0);

      case "thematicBreak":
        return "#block[#v(6pt)#line(length: 100%, stroke: 0.5pt + luma(180))#v(6pt)]";

      case "break":
        return " \\\n";

      // ── Soft break: CommonMark semantics → space ──
      // remark-parse does not emit "softBreak" nodes by default;
      // soft breaks appear as spaces in text nodes. But handle it
      // just in case a plugin emits them.

      case "table":
        return serializeTable(node as MdastTable);

      case "footnoteReference":
        return serializeFootnoteRef(node as MdastFootnoteReference);

      case "footnoteDefinition":
        // Definitions are consumed by the reference pass; don't emit directly
        return "";

      // ── Deferred nodes: warn + placeholder ──

      case "image": {
        const img = node as MdastImage;
        const url = img.url || "";
        const alt = img.alt || "";
        if (url) {
          return emitImage(url, alt);
        }
        return escapeText(`[Image: ${alt || "no source"}]`);
      }

      case "imageReference": {
        const ref = node as MdastImageReference;
        const id = ref.identifier;
        const def = definitionDefs.get(id);
        const alt = ref.alt || "";
        if (def) {
          return emitImage(def, alt);
        }
        warnings.warn("imageReference", `Unresolved image reference: ${id}`);
        return escapeText(`[Image: ${alt || id}]`);
      }

      case "definition":
        // Consumed by the definition collection pass
        return "";

      case "delete":
        return `#strike[${serializeChildren(node as MdastDelete)}]`;

      case "subscript":
        return `#sub[${serializeChildren(node as MdastSubscript)}]`;

      case "superscript":
        return `#super[${serializeChildren(node as MdastSuperscript)}]`;

      case "mark":
        return `#highlight[${serializeChildren(node as MdastMark)}]`;

      // ── Unsupported nodes: warn + placeholder ──

      case "html": {
        const html = node as MdastHtml;
        const preview = html.value.slice(0, 40).replace(/\n/g, " ");
        warnings.warn("html", `HTML removed: ${preview}`);
        return escapeText("[HTML block removed]");
      }

      default: {
        warnings.warn(
          node.type,
          `Unsupported node: ${node.type}`,
        );
        return escapeText(`[⚠ unsupported: ${node.type}]`);
      }
    }
  }

  // ── Lists ───────────────────────────────────────────────────────

  function serializeList(list: MdastList, depth: number): string {
    const indent = "  ".repeat(depth);
    const lines: string[] = [];

    for (let i = 0; i < list.children.length; i++) {
      const item = list.children[i];
      const marker = list.ordered ? "+ " : "- ";

      const blocks: string[] = [];
      for (const child of item.children) {
        if (child.type === "list") {
          blocks.push(serializeList(child as MdastList, depth + 1));
        } else {
          blocks.push(serialize(child));
        }
      }

      // First block gets the marker; continuation blocks get indentation
      const first = blocks.shift() ?? "";
      lines.push(`${indent}${marker}${first}`);
      for (const block of blocks) {
        // Nested lists already have their own indentation
        if (block.startsWith(indent + "  ")) {
          lines.push(block);
        } else {
          lines.push(`${indent}  ${block}`);
        }
      }
    }

    return lines.join("\n");
  }

  // ── Tables ──────────────────────────────────────────────────────

  function serializeTable(table: MdastTable): string {
    if (table.children.length === 0) return "";

    // Warn if alignment metadata is present (we don't support it)
    if (table.align?.some((a) => a !== null)) {
      warnings.warn(
        "table",
        "Table column alignment is not supported; alignment metadata discarded",
      );
    }

    const columnCount = table.children[0]?.children?.length ?? 0;
    const cells: string[] = [];

    for (const row of table.children) {
      for (const cell of row.children) {
        const content = serializeChildren(cell as MdastTableCell);
        cells.push(`[${content}]`);
      }
    }

    return `#table(columns: ${columnCount}, ${cells.join(", ")})`;
  }

  // ── Footnotes ───────────────────────────────────────────────────

  function serializeFootnoteRef(ref: MdastFootnoteReference): string {
    const id = ref.identifier;
    const def = footnoteDefs.get(id);

    if (!def) {
      warnings.warn(
        "footnoteReference",
        `Missing footnote definition: ${id}`,
      );
      return escapeText(`[⚠ missing footnote: ${id}]`);
    }

    const count = (footnoteRefCount.get(id) ?? 0) + 1;
    footnoteRefCount.set(id, count);

    if (count === 1) {
      // First reference: render labeled footnote
      const content = def.map((child) => serialize(child)).join("\n\n");
      const label = escapeLabel(`fn-${id}`);
      return `#footnote[${content}] <${label}>`;
    } else {
      // Subsequent reference: reference the label
      const label = escapeLabel(`fn-${id}`);
      return `@${label}`;
    }
  }

  // Run the serializer
  const body = serialize(tree);

  // Check for orphan footnote definitions
  for (const [id] of footnoteDefs) {
    if (!footnoteRefCount.has(id)) {
      warnings.warn(
        "footnoteDefinition",
        `Orphan footnote definition (no references): ${id}`,
      );
    }
  }

  return body;
}

// ── Helpers ─────────────────────────────────────────────────────────

function collectDefinitions(
  tree: Node,
  defs: Map<string, string>,
) {
  if (tree.type === "definition") {
    const d = tree as MdastDefinition;
    defs.set(d.identifier, d.url);
  }
  if ("children" in tree) {
    for (const child of (tree as Parent).children) {
      collectDefinitions(child, defs);
    }
  }
}

function collectFootnotes(
  tree: Node,
  defs: Map<string, Node[]>,
) {
  if (tree.type === "footnoteDefinition") {
    const fd = tree as MdastFootnoteDefinition;
    defs.set(fd.identifier, (fd as Parent).children as Node[]);
  }
  if ("children" in tree) {
    for (const child of (tree as Parent).children) {
      collectFootnotes(child, defs);
    }
  }
}
