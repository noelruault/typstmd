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
import remarkHardBreaks from "./remark-hard-breaks";
import { mdastToTypst } from "./mdast-to-typst";
import { extractFrontmatter, encodeConfInvocation } from "./frontmatter";
import { getTheme, EMOJI_FONT, type Theme } from "./themes/index";
import { createWarningCollector, type Warning } from "./warnings";

export interface PipelineResult {
  typstSource: string;
  warnings: readonly Warning[];
  /** Set when the document contains emoji, so the caller loads the 10.7 MB emoji font. */
  needsEmojiFont: boolean;
}

const EMOJI_PATTERN = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;

export interface PipelineOptions {
  themeId?: string;
  hardBreaks?: boolean;
  templateOverride?: string;
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

  if (options?.hardBreaks) {
    processor.use(remarkHardBreaks);
  }

  const tree = processor.runSync(processor.parse(markdown));

  // Extract frontmatter
  const metadata = extractFrontmatter(tree);

  // Transform MDAST to Typst body
  const warnings = createWarningCollector();
  const body = mdastToTypst(tree, { warnings });

  // Assemble full Typst source with selected theme
  const theme = getTheme(options?.themeId ?? "default");
  const confInvocation = encodeConfInvocation(metadata);

  const templateSource = options?.templateOverride ?? theme.template;
  const needsEmojiFont = EMOJI_PATTERN.test(body);

  // Targeted rule rather than a theme-wide fallback list: Typst warns for every family it cannot resolve even when unused, and the emoji font is only loaded for documents using it.
  const emojiRule = needsEmojiFont
    ? `#show regex("\\p{Emoji_Presentation}"): it => text(font: "${EMOJI_FONT.family}", it)`
    : "";

  const typstSource = [templateSource, confInvocation, emojiRule, body]
    .filter((part) => part !== "")
    .join("\n\n");

  return {
    typstSource,
    warnings: warnings.getWarnings(),
    needsEmojiFont,
  };
}
