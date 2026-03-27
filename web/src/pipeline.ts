/**
 * Unified pipeline: Markdown string → Typst source string.
 *
 * parse → extract frontmatter → transform MDAST → assemble Typst source
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkEmoji from "remark-emoji";
import remarkSubSuper from "./remark-sub-super";
import remarkHighlight from "./remark-highlight";
import { mdastToTypst } from "./mdast-to-typst";
import { extractFrontmatter, encodeConfInvocation } from "./frontmatter";
import { getTheme, type Theme } from "./themes/index";
import { createWarningCollector, type Warning } from "./warnings";

export interface PipelineResult {
  typstSource: string;
  warnings: readonly Warning[];
}

export interface PipelineOptions {
  themeId?: string;
}

export function markdownToTypst(
  markdown: string,
  options?: PipelineOptions,
): PipelineResult {
  // Parse markdown to MDAST
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm, { singleTilde: false })
    .use(remarkEmoji)
    .use(remarkSubSuper)
    .use(remarkHighlight);

  const tree = processor.runSync(processor.parse(markdown));

  // Extract frontmatter
  const metadata = extractFrontmatter(tree);

  // Transform MDAST to Typst body
  const warnings = createWarningCollector();
  const body = mdastToTypst(tree, { warnings });

  // Assemble full Typst source with selected theme
  const theme = getTheme(options?.themeId ?? "default");
  const confInvocation = encodeConfInvocation(metadata);

  const typstSource = [theme.template, confInvocation, body].join("\n\n");

  return {
    typstSource,
    warnings: warnings.getWarnings(),
  };
}
