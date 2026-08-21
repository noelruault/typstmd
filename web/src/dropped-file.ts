export type DroppedKind = "markdown" | "template" | "asset";

const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkd"];

// A `.typ` must not fall through to "asset": mapping it into the VFS does nothing visible.
export function classifyDroppedFile(name: string, mimeType = ""): DroppedKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".typ")) return "template";
  if (MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "markdown";
  if (mimeType === "text/markdown") return "markdown";
  return "asset";
}
