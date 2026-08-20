/**
 * Custom remark plugin for subscript (~text~) and superscript (^text^) syntax.
 *
 * Compatible with remark-parse v11+ (micromark-based).
 * Produces MDAST nodes: { type: "subscript", children } and { type: "superscript", children }.
 *
 * Uses a tree transform (MDAST visitor) rather than a micromark extension,
 * because GFM's ~~ strikethrough extension makes micromark-level ~ handling complex.
 */

import type { Root, Text, PhrasingContent } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// Whitespace inside the delimiters is not markup.
// `~300 subs at €50/mo (~` must stay prose, not become a subscript that swallows the clause.
const SUB_RE = /~([^\s~]+)~/g;
const SUPER_RE = /\^([^\s^]+)\^/g;

const remarkSubSuper: Plugin<[], Root> = function () {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index: number | undefined, parent: any) => {
      if (index === undefined || !parent) return;

      const value = node.value;
      const children: PhrasingContent[] = [];
      let lastIndex = 0;
      let modified = false;

      const combined = new RegExp(`${SUB_RE.source}|${SUPER_RE.source}`, "g");
      let match;

      while ((match = combined.exec(value)) !== null) {
        modified = true;
        // Text before match
        if (match.index > lastIndex) {
          children.push({ type: "text", value: value.slice(lastIndex, match.index) });
        }

        if (match[1] !== undefined) {
          // Subscript
          children.push({
            type: "subscript",
            children: [{ type: "text", value: match[1] }],
          } as any);
        } else if (match[2] !== undefined) {
          // Superscript
          children.push({
            type: "superscript",
            children: [{ type: "text", value: match[2] }],
          } as any);
        }

        lastIndex = match.index + match[0].length;
      }

      if (!modified) return;

      // Remaining text after last match
      if (lastIndex < value.length) {
        children.push({ type: "text", value: value.slice(lastIndex) });
      }

      // Replace the text node with the new children
      parent.children.splice(index, 1, ...children);
      return index + children.length;
    });
  };
};

export default remarkSubSuper;
