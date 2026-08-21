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
import {
  extractFrontmatter,
  encodeConfInvocation,
  encodeDocumentSet,
  encodeFrontmatterDict,
  type Metadata,
} from "./frontmatter";
import { getTheme, EMOJI_FONT, type Theme } from "./themes/index";
import { createWarningCollector, type Warning } from "./warnings";

export interface PipelineResult {
  typstSource: string;
  warnings: readonly Warning[];
  /** Set when the document contains emoji, so the caller loads the 10.7 MB emoji font. */
  needsEmojiFont: boolean;
}

const EMOJI_PATTERN = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;

// The serializer emits a fenced block as ```<lang>\n…\n```; this matches a mermaid one at a line start.
const MERMAID_FENCE = /(^|\n)```mermaid\n/;

// Injected verbatim by both front-ends (cmd/filters/mermaid.lua mirrors this exactly, so parity holds).
// width caps the diagram so a pie or bar does not fill the page; centered so it sits under its heading. A long xychart category label clips at the plot edge whichever orientation is used; that is a mermaid limitation, left as-is.
const MERMAID_PREAMBLE = [
  '#import "@preview/merman:0.1.0": show-mermaid-blocks',
  '#show raw.where(lang: "mermaid"): it => align(center, show-mermaid-blocks(width: 62%)(it))',
].join("\n");

/** Substituted with the serialised body, for templates that choose where content lands. */
const BODY_MARKER = "#typstmd-body";

const DEFINES_CONF = /(^|\n)\s*#?let\s+conf\s*\(/;

// Injecting a `conf` call unconditionally is what stopped any template from typst.app compiling.
function assemble(
  template: string,
  metadata: Metadata,
): { preamble: string; bodyWrapper: (body: string) => string } {
  if (DEFINES_CONF.test(template)) {
    return {
      preamble: `${template}\n\n${encodeConfInvocation(metadata)}`,
      bodyWrapper: (body) => body,
    };
  }

  if (template.includes(BODY_MARKER)) {
    return {
      preamble: "",
      bodyWrapper: (body) => template.split(BODY_MARKER).join(body),
    };
  }

  // No conf to receive metadata, so document properties go through Typst's own mechanism.
  return {
    preamble: [template, encodeDocumentSet(metadata)].filter((p) => p !== "").join("\n\n"),
    bodyWrapper: (body) => body,
  };
}

export interface PipelineOptions {
  themeId?: string;
  hardBreaks?: boolean;
  templateOverride?: string;
  /** Image URL or path to the VFS path the compiler was given; see resources.ts. */
  assets?: Map<string, string>;
  /** Render mermaid fences via merman (default) or leave them as source. The CLI's `--mermaid` is the same switch. */
  mermaid?: boolean;
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
  const body = mdastToTypst(tree, { warnings, assets: options?.assets });

  const theme = getTheme(options?.themeId ?? "default");
  const templateSource = options?.templateOverride ?? theme.template;
  const needsEmojiFont = EMOJI_PATTERN.test(body);
  const frontmatterDict = encodeFrontmatterDict(metadata);

  // Targeted rule rather than a theme-wide fallback list: Typst warns for every family it cannot resolve even when unused, and the emoji font is only loaded for documents using it.
  const emojiRule = needsEmojiFont
    ? `#show regex("\\p{Emoji_Presentation}"): it => text(font: "${EMOJI_FONT.family}", it)`
    : "";

  // Kept out of the themes so every template renders mermaid identically; the CLI's mermaid.lua injects the same block, so it must stay byte-identical there.
  const mermaidRule = (options?.mermaid ?? true) && MERMAID_FENCE.test(body)
    ? MERMAID_PREAMBLE
    : "";

  const { preamble, bodyWrapper } = assemble(templateSource, metadata);
  const typstSource = [frontmatterDict, preamble, emojiRule, mermaidRule, bodyWrapper(body)]
    .filter((part) => part !== "")
    .join("\n\n");

  return {
    typstSource,
    warnings: warnings.getWarnings(),
    needsEmojiFont,
  };
}
