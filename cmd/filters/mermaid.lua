-- Gated by `-M mermaid=true` (converter.sh's --mermaid). Injects the same two lines
-- web/src/pipeline.ts emits, so one Markdown file gives one PDF from either front-end.
-- Without the flag the fence stays a raw block and prints its source, identically on both sides.
local PREAMBLE = '#import "@preview/merman:0.1.0": show-mermaid-blocks\n#show raw.where(lang: "mermaid"): it => align(center, show-mermaid-blocks(width: 62%)(it))'

function Pandoc(doc)
  if not doc.meta.mermaid or pandoc.utils.stringify(doc.meta.mermaid) == "false" then
    return nil
  end
  for _, block in ipairs(doc.blocks) do
    if block.t == "CodeBlock" then
      for _, class in ipairs(block.classes) do
        if class == "mermaid" then
          table.insert(doc.blocks, 1, pandoc.RawBlock("typst", PREAMBLE))
          return doc
        end
      end
    end
  end
end
