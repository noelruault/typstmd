/**
 * Remark plugin: treat single newlines as hard line breaks.
 *
 * Standard markdown treats a single newline within a paragraph as a space.
 * This plugin converts those soft breaks into explicit "break" MDAST nodes,
 * so the serializer emits Typst hard breaks (`\`).
 */

import type { Root, Text, PhrasingContent } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const remarkHardBreaks: Plugin<[], Root> = function () {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (index == null || !parent) return;
      if (!node.value.includes("\n")) return;

      const parts = node.value.split("\n");
      const newNodes: PhrasingContent[] = [];

      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          newNodes.push({ type: "text", value: parts[i] });
        }
        if (i < parts.length - 1) {
          newNodes.push({ type: "break" });
        }
      }

      parent.children.splice(index, 1, ...newNodes);
    });
  };
};

export default remarkHardBreaks;
