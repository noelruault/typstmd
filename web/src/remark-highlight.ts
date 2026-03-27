/**
 * Custom remark plugin for ==highlighted text== syntax.
 *
 * Compatible with remark-parse v11+ (micromark-based).
 * Produces MDAST nodes: { type: "mark", children }.
 *
 * Uses a tree transform (MDAST visitor) to find ==text== patterns in text nodes.
 */

import type { Root, Text, PhrasingContent } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const MARK_RE = /==([^\s=][^=]*)==/g;

const remarkHighlight: Plugin<[], Root> = function () {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index: number | undefined, parent: any) => {
      if (index === undefined || !parent) return;

      const value = node.value;
      const children: PhrasingContent[] = [];
      let lastIndex = 0;
      let modified = false;
      let match;

      MARK_RE.lastIndex = 0;
      while ((match = MARK_RE.exec(value)) !== null) {
        modified = true;
        if (match.index > lastIndex) {
          children.push({ type: "text", value: value.slice(lastIndex, match.index) });
        }

        children.push({
          type: "mark",
          children: [{ type: "text", value: match[1] }],
        } as any);

        lastIndex = match.index + match[0].length;
      }

      if (!modified) return;

      if (lastIndex < value.length) {
        children.push({ type: "text", value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...children);
      return index + children.length;
    });
  };
};

export default remarkHighlight;
